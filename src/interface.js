'use strict';

//TODO status bar button to toggle menu bar
//TODO override Tegaki.center() to account for height of interface bars

import { localization } from './localization.js';

export class Menus {
	constructor(tegaki) {
		this.tegaki = tegaki;

		// menu
		this.menu = document.createElement('div');
		this.menu.id = 'tegaki-menu';
		this.contain_element_events(this.menu);

		// tool buttons
		this.tool_buttons = {};
		for (let tool_name in this.tegaki.tools) {
			let item_name = this.tegaki.tools[tool_name].name;
			this.tool_buttons[item_name] = this.add_interface_item(
				this.menu,
				'tegaki-menu-tool-' + item_name.replace('_', '-'),
				localization.tool_buttons[item_name].text,
				localization.tool_buttons[item_name].tip,
				e => {
					// intentionally clicking on toolbar to set tool pushes previous tool
					this.tegaki.previous_tool = this.tegaki.current_tool;
					this.tegaki.set_current_tool_by_name(e.currentTarget.dataset.name);
				},
				{'name': item_name}
			);
		}
		this.tegaki.tools.draw.tone = null;
		this.tegaki.tools.erase.tone = null;
		this.tegaki.tools.fill.tone = null;
		// listen for current tool change
		this.tegaki.workspace.addEventListener('current-tool-change', () => {
			for (let item_name in this.tool_buttons) {
				let item = this.tool_buttons[item_name];
				if (item_name == this.tegaki.current_tool.name) {
					item.classList.add('selected');
				}
				else {
					item.classList.remove('selected');
				}
				if (this.current_tool_is_brush_based()) {
					this.update_brush_shape();
					this.update_brush_size_indicator();
					this.brush_size_range.disabled = false;
					this.update_brush_size_range();
				}
				else {
					this.brush_size_range.disabled = true;
				}
				if (this.current_tool_can_use_tones()) {
					//TODO retrieve tone from current tool and switch to it
					this.update_tone_indicator();
				}
			}
		});
	
		// action buttons
		this.action_buttons = {
			'flip': null,
			'undo': null,
			'redo': null,
			'clear_in': null,
			//'clear_out': null,
			//'invert_selection': null,
			'save': null,
			'send': null,
			'wipe': null
		};
		for (let item_name in this.action_buttons) {
			this.action_buttons[item_name] = this.add_interface_item(
				this.menu,
				'tegaki-menu-action-' + item_name.replace('_', '-'),
				localization.action_buttons[item_name].text,
				localization.action_buttons[item_name].tip,
				e => {
					let name = e.currentTarget.dataset.name;
					if ('send' == name) {
						this.send();
						return;
					}
					this.tegaki[name]();
				},
				{'name': item_name}
			);
		}
		this.tegaki.workspace.addEventListener('flip', () => {
			if (this.tegaki.flipped) {
				this.action_buttons.flip.classList.add('selected');
			}
			else {
				this.action_buttons.flip.classList.remove('selected');
			}
		});

		// second row
		this.menu.appendChild(document.createElement('br'));

		// palette current colors
		this.palette_current = this.add_interface_item(
			this.menu,
			'tegaki-menu-palette-current',
		);
		// foreground
		this.palette_current_foreground = document.createElement('span');
		this.palette_current_foreground.id = 'tegaki-menu-palette-current-foreground';
		this.palette_current_foreground.title = localization.palette.current.foreground;
		this.tegaki.workspace.addEventListener('foreground-change', () => {
			this.palette_current_foreground.style.backgroundColor = 'rgba('
				+ this.tegaki.picker.foreground.r + ','
				+ this.tegaki.picker.foreground.g + ','
				+ this.tegaki.picker.foreground.b + ','
				+ this.tegaki.picker.foreground.a + ')';
		});
		this.palette_current_foreground.addEventListener('click', () => {
			this.tegaki.picker.open_picker('foreground');
		});
		this.palette_current.appendChild(this.palette_current_foreground);
		// background
		this.palette_current_background = document.createElement('span');
		this.palette_current_background.id = 'tegaki-menu-palette-current-background';
		this.palette_current_background.title = localization.palette.current.background;
		this.tegaki.workspace.addEventListener('background-change', () => {
			this.palette_current_background.style.backgroundColor = 'rgba('
				+ this.tegaki.picker.background.r + ','
				+ this.tegaki.picker.background.g + ','
				+ this.tegaki.picker.background.b + ','
				+ this.tegaki.picker.background.a + ')';
		});
		this.palette_current_background.addEventListener('click', () => {
			this.tegaki.picker.open_picker('background');
		});
		this.palette_current.appendChild(this.palette_current_background);

		// tones
		this.tone_indicator = this.add_interface_item(
			this.menu,
			'tegaki-menu-tone-indicator',
			'',
			localization.properties.tone_indicator,
			e => {
				if (!this.current_tool_can_use_tones()) {
					return;
				}
				this.position_tone_picker();
				this.tone_picker.classList.toggle('open');
			}
		);
		this.tone_picker = document.createElement('div');
		this.tone_picker.id = 'tegaki-menu-tone-picker';
		this.contain_element_events(this.tone_picker);
		this.tegaki.workspace.addEventListener('tones-loaded', () => {
			this.update_tone_picker();
		});
		this.tegaki.workspace.addEventListener('tone-change', () => {
			this.tone_picker.classList.remove('open');
			if (!this.current_tool_can_use_tones()) {
				return;
			}
			//TODO store tone on current tool
			this.update_tone_indicator();
		});
		this.tegaki.workspace.appendChild(this.tone_picker);

		// brush shape buttons
		this.brush_shape_buttons = {
			'square': null,
			'round': null,
		};
		for (let item_name in this.brush_shape_buttons) {
			this.brush_shape_buttons[item_name] = this.add_interface_item(
				this.menu,
				'tegaki-menu-tool-property-brush-shape-' + item_name,
				localization.properties.brush.shape_buttons[item_name].text,
				localization.properties.brush.shape_buttons[item_name].tip,
				e => {
					if (!this.current_tool_is_brush_based()) {
						return;
					}
					this.tegaki.current_tool.set_shape(e.currentTarget.dataset.name);
					this.update_brush_shape();
				},
				{'name': item_name}
			);
		}

		// brush size
		this.brush_size_indicator = this.add_interface_item(
			this.menu,
			'tegaki-menu-tool-property-brush-size-indicator'
		);
		// range
		this.brush_size_range = document.createElement('input');
		this.brush_size_range.id = 'tegaki-menu-tool-property-brush-size-range';
		this.brush_size_range.title = localization.properties.brush.size.range;
		this.brush_size_range.type = 'range';
		this.brush_size_range.step = 1;
		this.brush_size_range.min = 0;
		this.brush_size_range.max = 0;
		this.brush_size_range.value = 0;
		this.contain_element_events(this.brush_size_range);
		this.brush_size_range.addEventListener('input', e => {
			this.set_brush_size(this.brush_size_range.value);
			this.update_brush_size_indicator();
		});
		this.menu.appendChild(this.brush_size_range);
		// decrease
		this.brush_size_decrease = this.add_interface_item(
			this.menu,
			'tegaki-menu-tool-property-brush-size-decrease',
			'',
			localization.properties.brush.size.decrease,
			e => {
				if (!this.current_tool_is_brush_based()) {
					return;
				}
				let size = this.tegaki.current_tool.size;
				size -= 1;
				if (0 > size) {
					size = 0;
				}
				this.set_brush_size(size);
				this.update_brush_size_indicator();
				this.update_brush_size_range();
			}
		);
		// increase
		this.brush_size_increase = this.add_interface_item(
			this.menu,
			'tegaki-menu-tool-property-brush-size-increase',
			'',
			localization.properties.brush.size.increase,
			e => {
				if (!this.current_tool_is_brush_based()) {
					return;
				}
				let size = this.tegaki.current_tool.size;
				size += 1;
				if (this.brush_size_range.max < size) {
					size = this.brush_size_range.max;
				}
				this.set_brush_size(size);
				this.update_brush_size_indicator();
				this.update_brush_size_range();
			}
		);
		// update range max on canvas size change
		this.tegaki.workspace.addEventListener('canvas-size-change', () => {
			// set max brush size based on one-twelfth average canvas edge
			this.brush_size_range.max = Math.ceil(
				Math.sqrt(
					this.tegaki.canvas.width * this.tegaki.canvas.height
				) / 12
			);
		});

		// selection
		this.selection_action_buttons = {
			'deselect': null,
			'invert_selection': null,
			'crop_to_selection': null,
		};
		for (let item_name in this.selection_action_buttons) {
			this.selection_action_buttons[item_name] = this.add_interface_item(
				this.menu,
				'tegaki-menu-selection-' + item_name.replace(/_/g, '-'),
				localization.selection_action_buttons[item_name].text,
				localization.selection_action_buttons[item_name].tip,
				e => {
					this[e.currentTarget.dataset.name]();
				},
				{'name': item_name}
			);
		}
		this.tegaki.workspace.dataset.selectActive = 0;
		this.tegaki.workspace.addEventListener('select', () => {
			this.tegaki.workspace.dataset.selectActive = 1;
		});
		this.tegaki.workspace.addEventListener('deselect', () => {
			this.tegaki.workspace.dataset.selectActive = 0;
		});

		// status
		this.status = document.createElement('div');
		this.status.id = 'tegaki-status';
		this.contain_element_events(this.status);
		// status info
		this.status_boxes = {
			'coordinates': null,
			'zoom': null,
		};
		for (let item_name in this.status_boxes) {
			this.status_boxes[item_name] = this.add_interface_item(
				this.status,
				'tegaki-status-box-' + item_name,
				'',
				localization.status.boxes[item_name].tip,
			);
		}
		this.status_buttons = {
			'zoom_out': null,
			'zoom_in': null,
			'settings':null,
			'help': null,
			'fullscreen': null,
		};
		for (let item_name in this.status_buttons) {
			this['status_button_' + item_name] = this.add_interface_item(
				this.status,
				'tegaki-status-button-' + item_name.replace('_', '-'),
				localization.status.buttons[item_name].text,
				localization.status.buttons[item_name].tip,
				e => {
					this['status_' + e.currentTarget.dataset.name]();
				},
				{name: item_name}
			);
		}
		// status interval
		this.status_interval = null;
		this.set_status_interval(100);

		// fullscreen change
		document.addEventListener('fullscreenchange', e => {
			if (document.fullscreenElement) {
				this.tegaki.workspace.dataset.fullscreen = 1;
			}
			else {
				this.tegaki.workspace.dataset.fullscreen = 0;
			}
		});

		//TODO actual settings panel should be shortcut bindings and maybe max undo/redo history
		// temporary settings panel
		this.settings = document.createElement('div');
		this.settings.id = 'tegaki-settings';
		this.settings_dim = document.createElement('div');
		this.settings_dim.id = 'tegaki-settings-dim';
		this.settings_dim.addEventListener('click', () => {
			this.settings.classList.remove('open');
		});
		this.settings.innerHTML = '<h1>Settings</h1>'
			+ '<p>A temporary panel with some miscellaneous settings until they find homes in the UI proper</p>'
			+ '<table>'
			+ '<tr>'
			+ '	<td colspan="2">'
			+ '		<p>Switch between stroke interpolation methods</p>'
			+ '		<p>'
			+ '			<small>Eventually the old style hardcoded brush shapes will use an interpolation '
			+ '			method which will result in smooth curves when the cursor is moving quickly and '
			+ '			this setting will be replaced by an adjustable brush stabilizer in the tool bar</small>'
			+ '		</p>'
			+ '	</td>'
			+ '</tr>'
			+ '<tr>'
			+ '	<td><input id="interpolation-linear" name="interpolation" type="radio"></td>'
			+ '	<td>'
			+ '		<p>Use the old style hardcoded brush shapes, '
			+ '		which provides cleaner more consistent lines but results in straight lines '
			+ '		instead of curves when the cursor is moving quickly</p>'
			+ '	</td>'
			+ '</tr>'
			+ '<tr>'
			+ '	<td><input id="interpolation-canvas" name="interpolation" type="radio"></td>'
			+ '	<td>'
			+ '		<p>Use ctx.quadraticCurveTo and native canvas lines which results in smooth curves '
			+ '		when the cursor is moving quickly but sometimes results in less even line thickness '
			+ '		when anti-aliasing is turned off</p>'
			+ '	</td>'
			+ '</tr>'
			+ '<tr>'
			+ '	<td><input id="anti-aliasing" type="checkbox"></td>'
			+ '	<td>'
			+ '		<p>Use anti-aliasing</p>'
			+ '		<p>Currently, when using native canvas lines you can also toggle anti-aliasing</p>'
			+ '		<p>'
			+ '			<small>Eventually the anti-aliasing toggle will be replaced with an adjustable '
			+ '			brush softness in the tool bar</small>'
			+ '		</p>'
			+ '	</td>'
			+ '</tr>'
			+ '<tr><td colspan="2">Adjust the canvas size</td></tr>'
			+ '<tr>'
			+ '	<td colspan="2">'
			+ '		<input id="canvas-size-width" type="text">'
			+ '		x'
			+ '		<input id="canvas-size-height" type="text">'
			+ '		<input id="canvas-size-submit" type="submit" value="Resize">'
			+ '	</td>'
			+ '</tr>'
			+ '</table>';
		document.body.appendChild(this.settings);
		document.body.appendChild(this.settings_dim);
		// inputs
		this.settings_interpolation_linear = document.querySelector('#interpolation-linear');
		this.settings_interpolation_canvas = document.querySelector('#interpolation-canvas');
		this.settings_anti_aliasing = document.querySelector('#anti-aliasing');
		this.settings_canvas_size_width = document.querySelector('#canvas-size-width');
		this.settings_canvas_size_height = document.querySelector('#canvas-size-height');
		this.settings_canvas_size_submit = document.querySelector('#canvas-size-submit');
		// stop settings events from propagating
		this.contain_element_events(this.settings_interpolation_linear);
		this.contain_element_events(this.settings_interpolation_canvas);
		this.contain_element_events(this.settings_anti_aliasing);
		this.contain_element_events(this.settings_canvas_size_width);
		this.contain_element_events(this.settings_canvas_size_height);
		this.contain_element_events(this.settings_canvas_size_submit);
		// listeners
		this.settings_interpolation_linear.addEventListener('change', e => {
			this.set_interpolation('linear');
		});
		this.settings_interpolation_canvas.addEventListener('change', e => {
			this.set_interpolation('canvas');
		});
		this.settings_anti_aliasing.addEventListener('change', e => {
			this.set_anti_aliasing(e.currentTarget.checked);
		});
		this.settings_canvas_size_submit.addEventListener('click', e => {
			this.tegaki.resize(
				parseInt(this.settings_canvas_size_width.value),
				parseInt(this.settings_canvas_size_height.value)
			);
		});
		this.update_settings_values();

		// move wipe to beginning (so it alwas floats first row upper right)
		this.menu.insertBefore(this.action_buttons.wipe, this.tool_buttons.hand);

		// trigger initial brush size range max set
		this.tegaki.workspace.dispatchEvent(new Event('canvas-size-change'));
		// trigger initial tone set
		this.tegaki.workspace.dispatchEvent(new Event('tones-loaded'));
		this.tegaki.workspace.dispatchEvent(new Event('tone-change'));
		// trigger initial tool set
		this.tegaki.workspace.dispatchEvent(new Event('current-tool-change'));
		// trigger initial palette current color set
		this.tegaki.workspace.dispatchEvent(new Event('foreground-change'));
		this.tegaki.workspace.dispatchEvent(new Event('background-change'));
	}
	add_interface_item(container, id, text='', tip='', onclick=null, data_properties={}) {
		let item = document.createElement('span');
		item.classList.add('tegaki-interface-item');
		item.id = id;
		item.innerText = text;
		item.title = tip;
		if (onclick) {
			item.addEventListener('click', onclick);
		}
		for (let i in data_properties) {
			item.dataset[i] = data_properties[i];
		}
		this.contain_element_events(item);
		container.appendChild(item);
		return item;
	}
	contain_element_events(element) {
		element.addEventListener('click', e => {
			e.stopPropagation();
		});
		element.addEventListener('mousedown', e => {
			e.stopPropagation();
		});
		element.addEventListener('mouseup', e => {
			e.stopPropagation();
		});
		element.addEventListener('mousemove', e => {
			e.stopPropagation();
		});
		element.addEventListener('touchstart', e => {
			e.stopPropagation();
		});
		element.addEventListener('touchend', e => {
			e.stopPropagation();
		});
		element.addEventListener('touchmove', e => {
			e.stopPropagation();
		});
	}
	current_tool_is_brush_based() {
		if (-1 != ['draw', 'erase'].indexOf(this.tegaki.current_tool.name)) {
			return true;
		}
		return false;
	}
	current_tool_can_use_tones() {
		if (-1 != ['draw', 'erase', 'fill'].indexOf(this.tegaki.current_tool.name)) {
			return true;
		}
		return false;
	}
	update_brush_shape() {
		if (!this.current_tool_is_brush_based()) {
			return;
		}
		for (let item_name in this.brush_shape_buttons) {
			let brush_shape_button = this.brush_shape_buttons[item_name];
			if (item_name == this.tegaki.current_tool.shape) {
				brush_shape_button.classList.add('selected');
			}
			else {
				brush_shape_button.classList.remove('selected');
			}
		}
	}
	update_brush_size_indicator() {
		if (!this.current_tool_is_brush_based()) {
			return;
		}
		this.brush_size_indicator.innerText = this.tegaki.current_tool.size;
	}
	update_brush_size_range() {
		if (!this.current_tool_is_brush_based()) {
			return;
		}
		this.brush_size_range.value = this.tegaki.current_tool.size;
	}
	set_brush_size(size) {
		if (!this.current_tool_is_brush_based()) {
			return;
		}
		this.tegaki.current_tool.set_size(size);
	}
	update_tone_indicator() {
		if (!this.current_tool_can_use_tones()) {
			return;
		}
		if (0 == this.tone_picker.childNodes.length) {
			return;
		}
		this.tone_indicator.dataset.name = 'clear';
		this.tone_indicator.style.backgroundImage = '';
		for (let i = 0; i < this.tone_picker.childNodes.length; i++) {
			let tone_picker_item = this.tone_picker.childNodes[i];
			if (
				this.tegaki.tones.current_tone
				&& this.tegaki.tones.current_tone.name == tone_picker_item.dataset.name
			) {
				tone_picker_item.classList.add('selected');
				this.tone_indicator.style.backgroundImage = tone_picker_item.style.backgroundImage;
				this.tone_indicator.dataset.name = this.tegaki.tones.current_tone.name;
			}
			else {
				tone_picker_item.classList.remove('selected');
			}
			if (!this.tegaki.tones.current_tone) {
				this.tone_picker.childNodes[0].classList.add('selected');
			}
		}
	}
	add_tone_picker_item(tone=null) {
		let item = document.createElement('span');
		item.classList.add('tegaki-menu-tone-picker-item');
		if (!tone) {
			// create clear tone item
			item.dataset.name = 'clear';
			item.title = localization.tones.clear;
			item.addEventListener('click', e => {
				this.tone_picker.classList.remove('open');
				this.tegaki.tones.clear_tone();
				for (let i = 0; i < this.tone_picker.childNodes.length; i++) {
					this.tone_picker.childNodes[i].classList.remove('selected');
				}
				this.update_tone_indicator();
			});
		}
		else {
			item.dataset.name = tone.name;
			if (tone.display) {
				item.title = tone.display;
			}
			let canvas = document.createElement('canvas');
			canvas.width = tone.canvas.width;
			canvas.height = tone.canvas.height;
			let ctx = canvas.getContext('2d');
			ctx.globalCompositeOperation = 'source-over';
			ctx.fillStyle = 'rgba(0, 0, 0, 1)';
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.globalCompositeOperation = 'destination-out';
			ctx.drawImage(tone.canvas, 0, 0);
			item.style.backgroundImage = 'url(' + canvas.toDataURL() + ')';
			item.addEventListener('click', e => {
				this.tone_picker.classList.remove('open');
				this.tegaki.tones.set_tone_by_name(e.currentTarget.dataset.name);
				this.update_tone_indicator();
			});
		}
		this.tone_picker.appendChild(item);
	}
	update_tone_picker() {
		this.tone_picker.innerHTML = '';
		this.add_tone_picker_item();
		for (let tone_name in this.tegaki.tones.tones) {
			this.add_tone_picker_item(this.tegaki.tones.tones[tone_name]);
		}
	}
	position_tone_picker() {
		this.tone_picker.style.top = this.menu.clientHeight + 'px';
	}
	send() {
		this.tegaki._send();
		this.tegaki.alert(localization.action_buttons.send.alert);
		//TODO actual send here
		//let data = this.tegaki.get_presave_canvas().toDataURL();
	}
	deselect() {
		this.tegaki.selection.deselect();
	}
	invert_selection() {
		this.tegaki.selection.invert_selection();
	}
	crop_to_selection() {
		switch (this.tegaki.selection.crop_to_selection()) {
			case 1:
				this.tegaki.alert(
					localization.selection_action_buttons.crop_to_selection.alert.no_selection
				);
				break;
			case 2:
				this.tegaki.alert(
					localization.selection_action_buttons.crop_to_selection.alert.no_data
				);
				break;
			case 0:
			default:
				break;
		}
	}
	set_status_interval(interval_ms) {
		if (this.status_interval) {
			clearInterval(this.status_interval);
		}
		this.status_interval = setInterval(() => {
			this.status_update();
		}, interval_ms);
	}
	status_update() {
		let cursor = {
			x: Math.floor(this.tegaki.cursor.canvas.x),
			y: Math.floor(this.tegaki.cursor.canvas.y),
		};
		this.status_boxes.coordinates.innerText = cursor.x + ',' + cursor.y;
		this.status_boxes.zoom.innerText = (this.tegaki.zoom * 100) + '%';
	}
	status_zoom_in() {
		this.tegaki.zoom_in();
		this.tegaki.center();
	}
	status_zoom_out() {
		this.tegaki.zoom_out();
		this.tegaki.center();
	}
	status_help() {
		let help = window.open(
			'https://github.com/secretisdead/tegaki/blob/master/HELP.md',
			'_blank'
		);
		help.focus();
	}
	status_fullscreen() {
		if (document.fullscreenElement) {
			document.exitFullscreen();
		}
		else {
			this.tegaki.workspace.requestFullscreen();
		}
	}
	status_settings() {
		//TODO fix settings panel so it can be used in fullscreen
		//TODO for now kicking out of fullscreen
		if (document.fullscreenElement) {
			document.exitFullscreen();
		}
		this.update_settings_values();
		this.settings.classList.toggle('open');
	}
	update_settings_values() {
		this.settings_interpolation_linear.checked = false;
		this.settings_interpolation_canvas.checked = false;
		switch (this.tegaki.tools.draw.interpolation) {
			case 'linear':
				this.settings_interpolation_linear.checked = true;
				break;
			case 'canvas':
			default:
				this.settings_interpolation_canvas.checked = true;
				break;
		}
		this.settings_anti_aliasing.checked = 1 == this.tegaki.tools.draw.softness;
		this.settings_canvas_size_width.value = this.tegaki.canvas.width;
		this.settings_canvas_size_height.value = this.tegaki.canvas.height;
	}
	set_interpolation(interpolation) {
		this.tegaki.tools.draw.interpolation = interpolation;
		this.tegaki.tools.erase.interpolation = interpolation;
	}
	set_anti_aliasing(anti_aliasing=false) {
		let softness = 0;
		if (anti_aliasing) {
			softness = 1;
		}
		this.tegaki.tools.draw.softness = softness;
		this.tegaki.tools.erase.softness = softness;
	}
}
