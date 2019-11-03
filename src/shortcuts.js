'use strict';

//TODO key rebinding with some kind of popup prompt per binding or menu of fields of all bindings
//TODO read saved settings from localstorage

export class KeyboardShortcuts {
	constructor(menus) {
		this.menus = menus;
		this.tegaki = this.menus.tegaki;
		this.temp_tool = null;
		this.stored_current_tool = null;
		// default bindings
		this.bindings = {
			tools: {
				hand: {
					key: 'l',
				},
				magnifier: {
					key: 'm',
				},
				draw: {
					key: 'b',
				},
				erase: {
					key: 'e',
				},
				eyedropper: {
					key: 'i',
				},
				fill: {
					key: 'f',
				},
			},
			actions: {
				flip: {
					key: 'h',
				},
				undo: {
					ctrl: true,
					key: 'z',
				},
				redo: {
					ctrl: true,
					key: 'y',
				},
				save: {
					ctrl: true,
					key: 's',
				},
				send: {
					ctrl: true,
					key: 'u',
				},
				clear_in: {
					key: 'Delete',
				},
				clear_out: {
					ctrl: true,
					key: 'Delete',
				},
				wipe: {
					key: 'Escape',
				},
			},
			palette: {
				foreground: {
					ctrl: true,
					key: 'f'
				},
				background: {
					ctrl: true,
					key: 'b'
				},
			},
			tool_properties: {
				brush: {
					shapes: {
						square: {
							alt: true,
							key: 's',
						},
						round: {
							alt: true,
							key: 'r',
						},
					},
					size: {
						decrease: {
							key: 'a',
						},
						increase: {
							key: 's',
						},
					},
				},
			},
			headless: {
				swap_tool: {
					key: 'x',
				},
			},
			// these should only be single keys with no modifiers
			// to reliably enter and exit the temp tool state
			temp_tools: {
				hand: {
					key: ' ',
				},
				eyedropper: {
					key: 'Alt',
				},
				/** /
				move: {
					key: 'Control',
					active: false,
				}
				/**/
			},
			temp_modifiers: {
				select: {
					add: {
						key: 'Shift',
					},
					remove: {
						key: 'Alt',
					},
				},
			},
		};
		window.addEventListener('keydown', e => {
			if ('INPUT' == document.activeElement.tagName) {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			if (e.repeat) {
				return;
			}
			// single dimensional menu bindings (tool, action)
			let menu_names = ['tool', 'action'];
			for (let i in menu_names) {
				let menu_name = menu_names[i];
				let menu = this.menus[menu_name + '_buttons'];
				for (let item_name in this.bindings[menu_name + 's']) {
					if (this.check_binding(e, this.bindings[menu_name + 's'][item_name])) {
						menu[item_name].click();
					}
				}
			}
			// palette
			if (this.check_binding(e, this.bindings.palette.foreground)) {
				this.menus.palette_current_foreground.click();
			}
			if (this.check_binding(e, this.bindings.palette.background)) {
				this.menus.palette_current_background.click();
			}
			// brush property
			if (this.check_binding(e, this.bindings.tool_properties.brush.shapes.square)) {
				this.menus.brush_shape_buttons.square.click();
			}
			if (this.check_binding(e, this.bindings.tool_properties.brush.shapes.round)) {
				this.menus.brush_shape_buttons.round.click();
			}
			if (this.check_binding(e, this.bindings.tool_properties.brush.size.decrease)) {
				this.menus.brush_size_decrease.click();
			}
			if (this.check_binding(e, this.bindings.tool_properties.brush.size.increase)) {
				this.menus.brush_size_increase.click();
			}
			// temp tool
			for (let tool_name in this.bindings.temp_tools) {
				if (this.check_binding(e, this.bindings.temp_tools[tool_name])) {
					this.temp_tool = tool_name;
					// current tool isn't the temp tool being switched to
					if (this.tegaki.current_tool.name != tool_name) {
						this.stored_current_tool = this.tegaki.current_tool;
					}
					this.tegaki.set_current_tool_by_name(tool_name);
					// only one temp tool active at a time
					break;
				}
			}
			// headless
			for (let name in this.bindings.headless) {
				if (this.check_binding(e, this.bindings.headless[name])) {
					this[name]();
				}
			}
			//TODO temp modifiers
		});
		window.addEventListener('keyup', e => {
			if ('INPUT' == document.activeElement.tagName) {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			for (let tool_name in this.bindings.temp_tools) {
				if (this.temp_tool == tool_name) {
					if (this.check_binding(e, this.bindings.temp_tools[tool_name])) {
						this.temp_tool = null;
						this.tegaki.set_current_tool(this.stored_current_tool);
						return;
					}
				}
			}
		});
		// hardcoded mousewheel to zoom
		window.addEventListener('wheel', e => {
			//TODO focus on canvas position
			if (0 > Math.sign(e.deltaY)) {
				this.tegaki.zoom_in();
			}
			else {
				this.tegaki.zoom_out();
			}
			//TODO for now just re-center
			this.tegaki.center();
		});
	}
	check_binding(e, binding) {
		if (e.key != binding.key) {
			return false;
		}
		if (
			binding.key != 'Alt'
			&& (
				(binding.alt && !e.altKey)
				|| (!binding.alt && e.altKey)
			)
		) {
			return false;
		}
		if (
			binding.key != 'Control'
			&& (
				(binding.ctrl && !e.ctrlKey)
				|| (!binding.ctrl && e.ctrlKey)
			)
		) {
			return false;
		}
		return true;
	}
	load_bindings(bindings) {
		this.bindings = bindings;
	}
	// headless bindings
	swap_tool() {
		this.tegaki.swap_tool();
	}
}
