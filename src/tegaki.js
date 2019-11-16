'use strict';

// tegaki by secret
// remember to be kind

//TODO select events should become part of the undo history maybe?
//TODO select rect dragging indicator should be 1px outline of rect of inverted canvas
//TODO brush quadratic interpolation for original brush shapes
//TODO  for smooth curves between large input gaps instead of straight lines while keeping good line quality
//TODO switching between brush and eraser with shortcut keys doesn't instantly draw new cursor shape
//TODO testing with limited workspace size embedded in a page for potentially setting up the board again
//TODO crossbrowser bugs:
//TODO  firefox styling of brush size range input is wrong?
//TODO  firefox is what's causing the weird double-back and overlap when using a sylus?

import { localization } from './localization.js';

export function erase_image_data_interior(image_data) {
	let data = image_data.data;
	// loop through image data pixels
	// starting on second row and ending on second to last row
	let row_length = image_data.width * 4;
	let erase = [];
	for (let i = row_length + 4; i < data.length - row_length; i += 4) {
		if (
			0 == i % row_length // left edge
			|| 0 == (i + 4) % row_length // right edge
		) {
			continue;
		}
		if (
			0 != data[i - row_length + 3] // pixel above was filled
			&& 0 != data[i + 4 + 3] // pixel to right was filled
			&& 0 != data[i + row_length + 3] // pixel below was filled
			&& 0 != data[i - 4 + 3] // pixel to left was filled
		) {
			erase.push(i);
		}
	}
	for (let i in erase) {
		data[erase[i] + 3] = 0;
	}
}

// color picker
export class ColorPicker {
	constructor(tegaki) {
		this.tegaki = tegaki;
		this.foreground = {
			r: 0,
			g: 0,
			b: 0,
			a: 1,
		};
		this.background = {
			r: 255,
			g: 255,
			b: 255,
			a: 1,
		};
	}
	set_color(color, r, g, b, a, event) {
		if (
			r == color.r
			&& g == color.g
			&& b == color.b
			&& a == color.a
		) {
			return;
		}
		color.r = r;
		color.g = g;
		color.b = b;
		color.a = a;
		this.tegaki.workspace.dispatchEvent(event);
	}
	set_foreground(r, g, b, a) {
		this.set_color(this.foreground, r, g, b, a, new Event('foreground-change'));
	}
	set_background(r, g, b, a) {
		this.set_color(this.background, r, g, b, a, new Event('background-change'));
	}
	static rgb2hex(color) {
		let hex = Number(color).toString(16);
		if (hex.length < 2) {
			hex = '0' + hex;
		}
		return hex;
	}
	static hex2rgba(hex) {
		// input should be #RRGGBBAA or #RRGGBB
		return {
			r: parseInt(hex.slice(1, 3), 16),
			g: parseInt(hex.slice(3, 5), 16),
			b: parseInt(hex.slice(5, 7), 16),
			a: (hex.length > 8 ? parseInt(hex.slice(7, 9), 16) / 255 : 1),
		};
	}
	open_picker(target) {}
}

//TODO custom color picker
//TODO with color triangle, hue bar, alpha bar, input boxes for rgba, custom palette color storage

class SystemColorPicker extends ColorPicker {
	constructor(tegaki) {
		super(tegaki);
		this.active = false;
		this.target = 'foreground';
		this.input = document.createElement('input');
		this.input.id = 'color-picker-input';
		this.input.type = 'color';
		this.input.value = 'rgba(0, 0, 0, 1)';
		this.input.style.position = 'absolute';
		this.input.addEventListener('change', e => {
			if (!this.active) {
				return;
			}
			let rgba = ColorPicker.hex2rgba(e.currentTarget.value);
			if ('foreground' == this.target) {
				this.set_foreground(rgba.r, rgba.g, rgba.b, rgba.a);
			}
			else if ('background' == this.target) {
				this.set_background(rgba.r, rgba.g, rgba.b, rgba.a);
			}
			this.active = false;
		});
		document.body.appendChild(this.input);
	}
	open_picker(target) {
		this.target = target;
		if ('foreground' == this.target) {
			this.input.value = '#'
				+ ColorPicker.rgb2hex(this.foreground.r)
				+ ColorPicker.rgb2hex(this.foreground.g)
				+ ColorPicker.rgb2hex(this.foreground.b);
		}
		else if ('background' == this.target) {
			this.input.value = '#'
				+ ColorPicker.rgb2hex(this.background.r)
				+ ColorPicker.rgb2hex(this.background.g)
				+ ColorPicker.rgb2hex(this.background.b);
		}
		this.active = true;
		this.input.click();
	}
}

// tools
export class Tool {
	constructor(tegaki) {
		this.tegaki = tegaki;
		this.name = 'tool';
		this.current = false;
	}
}

export class Hand extends Tool {
	constructor(tegaki) {
		super(tegaki);
		this.name = 'hand';
		this.active = false;
		this.last = {
			x: null,
			y: null,
		};
	}
	input_press(type) {
		this.active = true;
		this.last.x = this.tegaki.cursor.workspace.x;
		this.last.y = this.tegaki.cursor.workspace.y;
	}
	input_release(x, y) {
		this.active = false;
		this.last.x = null;
		this.last.y = null;
	}
	input_move() {
		if (!this.active) {
			return;
		}
		let dx = this.tegaki.cursor.workspace.x - this.last.x;
		let dy = this.tegaki.cursor.workspace.y - this.last.y;
		this.tegaki.set_focus(
			this.tegaki.focus.x + dx,
			this.tegaki.focus.y + dy
		);
		this.last.x = this.tegaki.cursor.workspace.x;
		this.last.y = this.tegaki.cursor.workspace.y;
	}
}

export class Magnifier extends Tool {
	constructor(tegaki) {
		super(tegaki);
		this.name = 'magnifier';
	}
	input_press(type) {
		switch (type) {
			case 'm2':
				this.tegaki.zoom_out();
				break;
			case 'm0':
			default:
				this.tegaki.zoom_in();
				break;
		}
		//TODO set focus relative to canvas cursor position and canvas center
		//TODO for now just recenter each time
		this.tegaki.center();
	}
}

export class Brush extends Tool {
	constructor(tegaki) {
		super(tegaki);
		this.name = 'brush';
		this.active = false;
		this.size = 0;
		this.shape = 'round';
		this.step = 1;
		this.softness = 1;
		this.stabilizer = 0;
		this.interpolation = 'linear';
		// point
		this.point = document.createElement('canvas');
		this.point.width = 2;
		this.point.height = 2;
		this.point_ctx = this.point.getContext('2d');
		// cursor
		this.cursor = document.createElement('canvas');
		this.cursor.width = 2;
		this.cursor.height = 2;
		this.cursor_ctx = this.cursor.getContext('2d');
		this.canvas_cursor = document.createElement('canvas');
		this.canvas_cursor.width = 2;
		this.canvas_cursor.height = 2;
		this.canvas_cursor_ctx = this.canvas_cursor.getContext('2d');
		// current stroke
		this.current_stroke = [];
		this.current_stroke_last_point = null;
		// stroke scratch
		this.scratch = document.createElement('canvas');
		this.scratch.width = 2;
		this.scratch.height = 2;
		this.scratch.id = 'tegaki-brush-stroke-scratch';
		this.scratch_ctx = this.scratch.getContext('2d');
		this.tegaki.workspace.addEventListener('canvas-size-change', () => {
			this.scratch.width = this.tegaki.canvas.width;
			this.scratch.height = this.tegaki.canvas.height;
			this.canvas_cursor.width = this.tegaki.canvas.width;
			this.canvas_cursor.height = this.tegaki.canvas.height;
		});
		this.tegaki.workspace.addEventListener('wipe', () => {
			this.clear_scratch();
		});
		// listener for current tool change
		// TODO (to try to draw cursor immediately after changing tools with shortcut keys)
		// TODO (doesn't work)
		this.tegaki.workspace.addEventListener('current-tool-change', () => {
			this.tegaki.clear_display();
			this.tegaki.draw_to_display(this.tegaki.canvas);
			if (this.current) {
				//this.draw_cursor();
			}
		});
		// listen for multitouch
		this.tegaki.workspace.addEventListener('multitouch-start', () => {
			if (this.active) {
				this.discard_stroke();
			}
		});
	}
	input_press(type) {
		if (this.tegaki.multitouch) {
			return;
		}
		this.tegaki.clear_display();
		this.tegaki.draw_to_display(this.tegaki.canvas);
		// right click cancels stroke
		if ('m2' == type) {
			if (this.active) {
				this.discard_stroke();
			}
			return;
		}
		this.start_stroke();
	}
	input_release(type) {
		this.tegaki.clear_display();
		this.tegaki.draw_to_display(this.tegaki.canvas);
		this.end_stroke();
	}
	input_move() {
		this.tegaki.clear_display();
		this.tegaki.draw_to_display(this.tegaki.canvas);
		this.update_stroke();
	}
	start_stroke() {
		if (this.active) {
			return;
		}
		this.active = true;
		this.current_stroke = [];
		this.current_stroke_painted_points = 0;
		this.current_stroke_last_point = null;
		this.clear_scratch();
		this.paint_point(
			this.tegaki.cursor.canvas.x,
			this.tegaki.cursor.canvas.y
		);
		this.update_stroke();
	}
	update_stroke() {
		if (!this.active) {
			return;
		}
		let point = {
			x: Math.floor(this.tegaki.cursor.canvas.x),
			y: Math.floor(this.tegaki.cursor.canvas.y),
		};
		this.current_stroke.push(point);
		if (!this.current_stroke_last_point) {
			this.paint_point(point.x, point.y);
			this.tegaki.apply_masks(this.scratch, this.scratch_ctx);
			this.current_stroke_last_point = point;
		}
		else {
			this.paint_stroke(this.current_stroke_last_point, point);
		}
	}
	end_stroke() {
		if (!this.active) {
			return;
		}
		this.update_stroke();
		this.active = false;
	}
	discard_stroke() {
		if (!this.active) {
			return;
		}
		this.clear_scratch();
		this.current_stroke = [];
		this.active = false;
	}
	clear_scratch() {
		this.scratch_ctx.clearRect(
			0,
			0,
			this.scratch.width,
			this.scratch.height
		);
	}
	set_shape(shape) {
		this.shape = shape;
		this.update_point();
	}
	set_size(size) {
		size = Math.floor(size);
		if (this.size == size) {
			return;
		}
		this.size = size;
		this.update_point();
		this.tegaki.workspace.dataset.toolSize = this.size;
	}
	squash_canvas_alpha(canvas, ctx=null) {
		if (!ctx) {
			ctx = canvas.getContext('2d');
		}
		let image_data = ctx.getImageData(
			0,
			0,
			canvas.width,
			canvas.height
		);
		let data = image_data.data;
		for (let i = 0; i < data.length; i += 4) {
			if (127 < data[i + 3]) {
				data[i + 3] = 255;
			}
			else {
				data[i + 3] = 0;
			}
		}
		ctx.putImageData(image_data, 0, 0);
	}
	build_point(size, shape) {
		let point = document.createElement('canvas');
		point.width = size * 2;
		point.height = size * 2;
		let point_ctx = point.getContext('2d');
		point_ctx.fillStyle = 'rgba(0, 0, 0, 1)';
		if (0 >= size) {
			point.width = 1;
			point.height = 1;
			point_ctx.fillRect(0, 0, 1, 1);
			return point;
		}
		switch (this.shape) {
			case 'round':
				if (7 > size) {
					// for better circles at smaller sizes draw a big circle and size down
					let temp = document.createElement('canvas');
					temp.width = 50;
					temp.height = 50;
					let temp_ctx = temp.getContext('2d');
					temp_ctx.fillStyle = 'rgba(0, 0, 0, 1)';
					temp_ctx.arc(25, 25, 25, 0 * Math.PI, 2 * Math.PI);
					temp_ctx.fill();
					this.squash_canvas_alpha(temp, temp_ctx);
					point_ctx.drawImage(temp, 0, 0, point.width, point.height);
					break;
				}
				point_ctx.arc(size, size, size, 0 * Math.PI, 2 * Math.PI);
				point_ctx.fill();
				this.squash_canvas_alpha(point, point_ctx);
				break;
			case 'square':
			default:
				point_ctx.fillRect(0, 0, point.width, point.height);
				break;
		}
		return point;
	}
	update_point() {
		this.point_ctx.clearRect(0, 0, this.point.width, this.point.height);
		let new_point = this.build_point(this.size, this.shape);
		this.point.width = new_point.width;
		this.point.height = new_point.height;
		this.point_ctx.drawImage(new_point, 0, 0);
		this.update_cursor();
		this.tegaki.workspace.dispatchEvent(new Event('brush-point-change'));
	}
	update_cursor() {
		// build brush cursor
		if (0 == this.size) {
			this.cursor.width = 1;
			this.cursor.height = 1;
			this.cursor_ctx.fillRect(0, 0, 1, 1);
			this.tegaki.workspace.dispatchEvent(new Event('brush-cursor-change'));
			return;
		}
		this.cursor.width = this.point.width;
		this.cursor.height = this.point.height;
		this.cursor_ctx.clearRect(0, 0, this.cursor.width, this.cursor.height);
		this.cursor_ctx.globalCompositeOperation = 'source-over';
		// simpler to draw square point outline manually
		if ('square' == this.shape) {
			this.cursor_ctx.fillRect(0, 0, this.cursor.width, this.cursor.height);
			this.cursor_ctx.clearRect(1, 1, this.cursor.width - 2, this.cursor.height - 2);
			this.tegaki.workspace.dispatchEvent(new Event('brush-cursor-change'));
		}
		// iterate over image data to draw round point outline
		else {
			let image_data = this.point_ctx.getImageData(
				0,
				0,
				this.point.width,
				this.point.height
			);
			erase_image_data_interior(image_data);
			this.cursor_ctx.putImageData(image_data, 0, 0);
		}
		// draw crosshairs if brush is large enough
		if (5 < this.size) {
			this.cursor_ctx.globalCompositeOperation = 'source-over';
			this.cursor_ctx.fillStyle = 'rgba(0, 0, 0, 1)';
			// down chevron
			this.cursor_ctx.fillRect(this.size - 4, this.size - 1, 4, 1);
			this.cursor_ctx.fillRect(this.size - 1, this.size - 4, 1, 4);
			// up chevron
			this.cursor_ctx.fillRect(this.size, this.size, 4, 1);
			this.cursor_ctx.fillRect(this.size, this.size, 1, 4);
		}
		//this.tegaki.clear_display();
		//this.tegaki.draw_to_display(this.tegaki.canvas);
		//this.draw_cursor(reference_canvas, reference_ctx);
		this.tegaki.workspace.dispatchEvent(new Event('brush-cursor-change'));
	}
	invert_rgb(original) {
		// exact inversion
		let inverse = {
			r: 255 - original.r,
			g: 255 - original.g,
			b: 255 - original.b,
		};
		// shift near components by 128
		let margin = 32;
		for (let component in inverse) {
			// inverse component is near original
			if (
				inverse[component] > original[component] - margin
				&& inverse[component] < original[component] + margin
			) {
				// shift by 128
				inverse[component] += 128;
				if (255 < inverse[component]) {
					inverse[component] -= 255;
				}
			}
		}
		return inverse;
	}
	invert_image_data(image_data) {
		for (let i = 0; i < image_data.data.length; i += 4) {
			if (0 == image_data.data[i + 3]) {
				continue;
			}
			let original = {
				r: image_data.data[i],
				g: image_data.data[i + 1],
				b: image_data.data[i + 2],
			};
			let inverse = this.invert_rgb(original);
			image_data.data[i] = inverse.r;
			image_data.data[i + 1] = inverse.g;
			image_data.data[i + 2] = inverse.b;
		}
	}
	update_canvas_cursor(reference_canvas, reference_ctx=null) {
		if (!reference_ctx) {
			reference_ctx = reference_canvas.getContext('2d');
		}
		this.canvas_cursor_ctx.globalCompositeOperation = 'source-over';
		this.canvas_cursor_ctx.clearRect(
			0,
			0,
			this.canvas_cursor.width,
			this.canvas_cursor.height
		);
		// fill with white and then background color
		this.canvas_cursor_ctx.fillStyle = 'rgba(255, 255, 255, 1)';
		this.canvas_cursor_ctx.fillRect(
			0,
			0,
			this.canvas_cursor.width,
			this.canvas_cursor.height
		);
		this.canvas_cursor_ctx.fillStyle = 'rgba(' 
			+ this.tegaki.picker.background.r + ','
			+ this.tegaki.picker.background.g + ','
			+ this.tegaki.picker.background.b + ','
			+ this.tegaki.picker.background.a + ')';
		this.canvas_cursor_ctx.fillRect(
			0,
			0,
			this.canvas_cursor.width,
			this.canvas_cursor.height
		);
		// draw canvas and reference canvas
		this.canvas_cursor_ctx.drawImage(this.tegaki.canvas, 0, 0);
		this.canvas_cursor_ctx.drawImage(reference_canvas, 0, 0);
		// clip at cursor
		let canvas_cursor_origin = {
			x: Math.floor(this.tegaki.cursor.canvas.x - this.cursor.width / 2),
			y: Math.floor(this.tegaki.cursor.canvas.y - this.cursor.height / 2),
		};
		this.canvas_cursor_ctx.globalCompositeOperation = 'destination-in';
		this.canvas_cursor_ctx.drawImage(
			this.cursor,
			canvas_cursor_origin.x,
			canvas_cursor_origin.y
		);
		// get image data
		// (of just the cursor area since there's nothing else on canvas_cursor)
		let image_data = this.canvas_cursor_ctx.getImageData(
			canvas_cursor_origin.x,
			canvas_cursor_origin.y,
			this.cursor.width,
			this.cursor.height
		);
		// cursor inversion
		this.invert_image_data(image_data);
		// put inverted cursor back
		this.canvas_cursor_ctx.putImageData(
			image_data,
			canvas_cursor_origin.x,
			canvas_cursor_origin.y,
			0,
			0,
			this.cursor.width,
			this.cursor.height
		);
	}
	paint_point(x, y) {
		this.scratch_ctx.globalCompositeOperation = 'source-over';
		this.scratch_ctx.fillStyle = 'rgba(0, 0, 0, 1)';
		x = Math.floor(x);
		y = Math.floor(y);
		if (0 == this.size) {
			this.scratch_ctx.fillRect(x, y, 1, 1);
			return;
		}
		this.scratch_ctx.drawImage(this.point, x - this.size, y - this.size);
	}
	paint_stroke(p1, p2) {
		this.scratch_ctx.globalCompositeOperation = 'source-over';
		switch (this.interpolation) {
			case 'none':
				this._interpolate_none(p1, p2);
				break;
			case 'quadratic':
				this._interpolate_quadratic();
				break;
			case 'canvas':
				this._interpolate_canvas();
				break;
			case 'linear':
			default:
				this._interpolate_linear(p1, p2);
				break;
		}
		this.tegaki.apply_masks(this.scratch, this.scratch_ctx);
	}
	_interpolate_none(p1, p2) {
		// just draw the current shape and size at the point
		this.paint_point(p2.x, p2.y);
		this.current_stroke_last_point = p2;
	}
	_interpolate_linear(p1, p2) {
		let dx = p1.x - p2.x;
		let dy = p1.y - p2.y;
		let adx = Math.abs(dx);
		let ady = Math.abs(dy);
		if (adx < this.step && ady < this.step) {
			return false;
		}
		let steps = Math.floor((adx > ady ? adx : ady) / this.step);
		let ix = 0;
		let iy = 0;
		let step_x = (dx / steps);
		let step_y = (dy / steps);
		for (let i = 0; i <= steps; i++) {
			ix = Math.floor(p2.x + (step_x * i));
			iy = Math.floor(p2.y + (step_y * i));
			this.paint_point(ix, iy);
		}
		this.paint_point(p2.x, p2.y);
		this.current_stroke_last_point = p2;
	}
	_interpolate_quadratic(p1, p2) {
		//TODO
	}
	_interpolate_canvas() {
		if (0 < this.size) {
			this.scratch_ctx.lineWidth = this.size * 2;
		}
		else {
			this.scratch_ctx.lineWidth = 1.01;
		}
		this.scratch_ctx.lineJoin = this.scratch_ctx.lineCap = this.shape;
		this.scratch_ctx.clearRect(
			0,
			0,
			this.scratch.width,
			this.scratch.height
		);

		let p1 = this.current_stroke[0];
		let p2 = this.current_stroke[1];

		this.scratch_ctx.beginPath();
		this.scratch_ctx.moveTo(p1.x, p1.y);

		for (let i = 1; i < this.current_stroke.length; i++) {
			let mp = {
				x: p1.x + (p2.x - p1.x) / 2,
				y: p1.y + (p2.y - p1.y) / 2,
			};
			this.scratch_ctx.quadraticCurveTo(p1.x, p1.y, mp.x, mp.y);
			p1 = this.current_stroke[i];
			p2 = this.current_stroke[i + 1];
		}
		this.scratch_ctx.lineTo(p1.x, p1.y);
		this.scratch_ctx.stroke();
		//TODO actual softness range instead of just on/off
		if (0 == this.softness) {
			this.squash_canvas_alpha(this.scratch, this.scratch_ctx);
		}
	}
}

export class Draw extends Brush {
	constructor(tegaki) {
		super(tegaki);
		this.name = 'draw';
	}
	draw_canvas_cursor_to_display() {
		this.update_canvas_cursor(this.scratch, this.scratch_ctx);
		this.tegaki.draw_to_display(this.canvas_cursor);
	}
	input_move() {
		super.input_move();
		this.draw_canvas_cursor_to_display();
	}
	update_stroke() {
		if (!this.active) {
			return;
		}
		super.update_stroke();
		// color stroke
		this.scratch_ctx.fillStyle = 'rgba('
			+ this.tegaki.picker.foreground.r + ','
			+ this.tegaki.picker.foreground.g + ','
			+ this.tegaki.picker.foreground.b + ','
			+ this.tegaki.picker.foreground.a + ')';
		this.scratch_ctx.globalCompositeOperation = 'source-atop';
		this.scratch_ctx.fillRect(0, 0, this.scratch.width, this.scratch.height);
		// draw scratch to display
		this.tegaki.draw_to_display(this.scratch);
	}
	end_stroke() {
		if (!this.active) {
			return;
		}
		super.end_stroke();
		// push current state to undo
		this.tegaki.redo_history = [];
		this.tegaki.push_undo_canvas();
		// merge final stroke scratch canvas to real canvas
		this.tegaki.canvas_ctx.globalCompositeOperation = 'source-over';
		this.tegaki.canvas_ctx.drawImage(this.scratch, 0, 0);
		this.tegaki.safety_save();
		this.draw_canvas_cursor_to_display();
	}
	discard_stroke() {
		super.discard_stroke();
		this.tegaki.clear_display();
		this.tegaki.draw_to_display(this.tegaki.canvas);
		this.draw_canvas_cursor_to_display();
	}
}

export class Erase extends Brush {
	constructor(tegaki) {
		super(tegaki);
		this.name = 'erase';
		this.temp = document.createElement('canvas');
		this.temp.width = 2;
		this.temp.height = 2;
		this.temp.id = 'tegaki-brush-stroke-temp';
		this.temp_ctx = this.temp.getContext('2d');
		// listener for canvas size change
		this.tegaki.workspace.addEventListener('canvas-size-change', () => {
			this.temp.width = this.tegaki.canvas.width;
			this.temp.height = this.tegaki.canvas.height;
		});
	}
	draw_canvas_cursor_to_display() {
		if (this.active) {
			// cursor will always be inverse of background color
			this.temp_ctx.globalCompositeOperation = 'destination-over';
			this.temp_ctx.fillStyle = 'rgba('
				+ this.tegaki.picker.background.r + ','
				+ this.tegaki.picker.background.g + ','
				+ this.tegaki.picker.background.b + ','
				+ '1)';
			this.temp_ctx.fillRect(0, 0, this.temp.width, this.temp.height);
		}
		this.update_canvas_cursor(this.temp, this.temp_ctx);
		this.tegaki.draw_to_display(this.canvas_cursor);
	}
	input_move() {
		super.input_move();
		this.draw_canvas_cursor_to_display();
	}
	update_stroke() {
		if (!this.active) {
			return;
		}
		super.update_stroke();
		this.temp_ctx.clearRect(
			0,
			0,
			this.temp.width,
			this.temp.height
		);
		// copy real canvas to temp
		this.temp_ctx.globalCompositeOperation = 'source-over';
		this.temp_ctx.drawImage(
			this.tegaki.canvas,
			0,
			0,
			this.temp.width,
			this.temp.height
		);
		// erase the stroke area from temp
		this.temp_ctx.globalCompositeOperation = 'destination-out';
		this.temp_ctx.drawImage(
			this.scratch,
			0,
			0,
			this.temp.width,
			this.temp.height
		);
		this.tegaki.clear_display();
		this.tegaki.draw_to_display(this.temp);
	}
	end_stroke() {
		if (!this.active) {
			return;
		}
		super.end_stroke();
		// push current state to undo
		this.tegaki.redo_history = [];
		this.tegaki.push_undo_canvas();
		// erase final stroke scratch canvas from real canvas
		this.tegaki.canvas_ctx.globalCompositeOperation = 'destination-out';
		this.tegaki.canvas_ctx.drawImage(this.scratch, 0, 0);
		this.tegaki.safety_save();
		this.draw_canvas_cursor_to_display();
	}
	discard_stroke() {
		super.discard_stroke();
		this.tegaki.clear_display();
		this.tegaki.draw_to_display(this.tegaki.canvas);
		this.draw_canvas_cursor_to_display();
	}
}

export class Eyedropper extends Tool {
	constructor(tegaki) {
		super(tegaki);
		this.name = 'eyedropper';
		this.active = false;
		this.target = 'foreground';
	}
	input_press(type) {
		// right click sets background
		if ('m2' == type) {
			this.target = 'background';
		}
		else {
			this.target = 'foreground';
		}
		this.active = true;
		this.pick_color();
	}
	input_release(type) {
		this.pick_color();
		this.active = false;
	}
	input_move() {
		this.pick_color();
	}
	pick_color() {
		if (!this.active) {
			return;
		}
		let data = this.tegaki.canvas_ctx.getImageData(
			this.tegaki.cursor.canvas.x,
			this.tegaki.cursor.canvas.y,
			1,
			1
		).data;
		switch (this.target) {
			case 'background':
				this.tegaki.picker.set_background(
					data[0],
					data[1],
					data[2],
					data[3]
				);
				break;
			case 'foreground':
			default:
				this.tegaki.picker.set_foreground(
					data[0],
					data[1],
					data[2],
					data[3]
				);
				break;
		}
	}
}

export class Fill extends Tool {
	constructor(tegaki) {
		super(tegaki);
		this.name = 'fill';
	}
	input_release(type) {
		this.fill();
	}
	fill() {
		let x = Math.floor(this.tegaki.cursor.canvas.x);
		let y = Math.floor(this.tegaki.cursor.canvas.y);
		// get current canvas data
		let image_data = this.tegaki.canvas_ctx.getImageData(
			0,
			0,
			this.tegaki.canvas.width,
			this.tegaki.canvas.height
		);
		// get target color
		let index = (y * image_data.width + x) * 4;
		let target = {
			r: image_data.data[index],
			g: image_data.data[index + 1],
			b: image_data.data[index + 2],
			a: image_data.data[index + 3],
		};
		// create empty fill mask data
		let fill = document.createElement('canvas');
		fill.width = this.tegaki.canvas.width;
		fill.height = this.tegaki.canvas.height;
		let fill_ctx = fill.getContext('2d');
		let fill_data = fill_ctx.createImageData(
			fill.width,
			fill.height
		);
		let filled = this.queue_fill(
			image_data,
			fill_data,
			x, y,
			target
		);
		console.log('fill successful (filled ' + filled + ' pixels)');
		// don't do anything for no change
		if (0 == filled) {
			return;
		}
		this.tegaki.push_undo_canvas();
		// replace fill mask with foreground color
		fill_ctx.putImageData(fill_data, 0, 0);
		fill_ctx.fillStyle = 'rgba('
			+ this.tegaki.picker.foreground.r + ','
			+ this.tegaki.picker.foreground.g + ','
			+ this.tegaki.picker.foreground.b + ','
			+ this.tegaki.picker.foreground.a + ')';
		fill_ctx.globalCompositeOperation = 'source-in';
		fill_ctx.fillRect(0, 0, fill.width, fill.height);
		// if there are masks in this.tegaki.masks apply them
		fill_ctx.globalCompositeOperation = 'destination-out';
		for (let i in this.tegaki.masks) {
			let mask = this.tegaki.masks[i];
			fill_ctx.drawImage(
				mask,
				0,
				0,
				fill.width,
				fill.height
			);
		}
		// add fill to canvas
		this.tegaki.canvas_ctx.drawImage(fill, 0, 0);
		this.tegaki.clear_display();
		this.tegaki.draw_to_display(this.tegaki.canvas);
		this.tegaki.safety_save();
	}
	queue_fill(
		image_data,
		fill_data,
		x, y,
		target
	) {
		let filled = 0;
		let queue = [];
		queue.push([x, y]);
		while (0 < queue.length) {
			let coords = queue.pop();
			let x = coords[0];
			let y = coords[1];
			// out of bounds
			if (
				0 > x
				|| x >= image_data.width
				|| 0 > y
				|| y >= image_data.height
			) {
				continue;
			}
			let index = (y * image_data.width + x) * 4;
			// pixel was already filled
			if (255 == fill_data.data[index + 3]) {
				continue;
			}
			// color at index is not target
			if (
				target.r != image_data.data[index]
				|| target.g != image_data.data[index + 1]
				|| target.b != image_data.data[index + 2]
				|| target.a != image_data.data[index + 3]
			) {
				continue;
			}
			fill_data.data[index + 3] = 255;
			filled += 1;
			//TODO max pixels to fill?
			queue.push([x, (y - 1)]);
			queue.push([x, (y + 1)]);
			queue.push([(x - 1), y]);
			queue.push([(x + 1), y]);
		}
		return filled;
	}
}

export class Move extends Tool {
	constructor(tegaki) {
		super(tegaki);
		this.name = 'move';
		this.active = false;
		this.cut_from = document.createElement('canvas');
		this.cut_from.width = this.tegaki.canvas.width;
		this.cut_from.height = this.tegaki.canvas.height;
		this.cut_from_ctx = this.cut_from.getContext('2d');
		this.cut_to = document.createElement('canvas');
		this.cut_to.width = this.tegaki.canvas.width;
		this.cut_to.height = this.tegaki.canvas.height;
		this.cut_to_ctx = this.cut_to.getContext('2d');
		this.floating = document.createElement('canvas');
		this.floating.width = this.tegaki.canvas.width;
		this.floating.height = this.tegaki.canvas.height;
		this.floating_ctx = this.floating.getContext('2d');
		this.tegaki.workspace.addEventListener('canvas-size-change', () => {
			this.cut_from.width = this.tegaki.canvas.width;
			this.cut_from.height = this.tegaki.canvas.height;
			this.cut_to.width = this.tegaki.canvas.width;
			this.cut_to.height = this.tegaki.canvas.height;
			this.floating.width = this.tegaki.canvas.width;
			this.floating.height = this.tegaki.canvas.height;
		});
		this.start = {
			x: null,
			y: null,
		};
		this.end = {
			x: null,
			y: null,
		};
	}
	input_press(type) {
		this.tegaki.clear_display();
		this.tegaki.draw_to_display(this.tegaki.canvas);
		// right click cancels move
		if ('m2' == type) {
			if (this.active) {
				this.discard_move();
			}
			return;
		}
		this.start_move();
	}
	input_release(x, y) {
		this.tegaki.clear_display();
		this.tegaki.draw_to_display(this.tegaki.canvas);
		this.end_move();
	}
	input_move() {
		this.tegaki.clear_display();
		this.tegaki.draw_to_display(this.tegaki.canvas);
		this.update_move();
	}
	start_move() {
		if (this.active) {
			return;
		}
		this.active = true;
		this.start.x = Math.floor(this.tegaki.cursor.canvas.x);
		this.start.y = Math.floor(this.tegaki.cursor.canvas.y);
		// clear cut_from and cut_to
		this.cut_from_ctx.clearRect(
			0,
			0,
			this.cut_from.width,
			this.cut_from.height
		);
		this.cut_to_ctx.clearRect(
			0,
			0,
			this.cut_to.width,
			this.cut_to.height
		);
		if (this.tegaki.selection.active) {
			console.log('selection active move');
			// draw canvas to cut_from and cut selection from it
			this.cut_from_ctx.globalCompositeOperation = 'source-over';
			this.cut_from_ctx.drawImage(this.tegaki.canvas, 0, 0);
			this.cut_from_ctx.globalCompositeOperation = 'destination-out';
			this.cut_from_ctx.drawImage(this.tegaki.selection.selection, 0, 0);
			// draw canvas to cut_to and cut non-selection from it
			this.cut_to_ctx.globalCompositeOperation = 'source-over';
			this.cut_to_ctx.drawImage(this.tegaki.canvas, 0, 0);
			this.cut_to_ctx.globalCompositeOperation = 'destination-in';
			this.cut_to_ctx.drawImage(this.tegaki.selection.selection, 0, 0);
		}
		// no selection moves entire canvas
		else {
			// draw entire canvas to cut_to
			this.cut_to_ctx.globalCompositeOperation = 'source-over';
			this.cut_to_ctx.drawImage(this.tegaki.canvas, 0, 0);
		}
		this.tegaki.selection.hide_ants = true;
		this.update_move();
	}
	update_move() {
		if (!this.active) {
			return;
		}
		this.end.x = Math.floor(this.tegaki.cursor.canvas.x);
		this.end.y = Math.floor(this.tegaki.cursor.canvas.y);
		let dx = this.end.x - this.start.x;
		let dy = this.end.y - this.start.y;
		// draw cut_to to floating at dx, dy
		this.floating_ctx.clearRect(0, 0, this.floating.width, this.floating.height);
		this.floating_ctx.drawImage(this.cut_to, dx, dy);
		this.tegaki.clear_display();
		this.tegaki.draw_to_display(this.cut_from);
		this.tegaki.draw_to_display(this.floating);
	}
	end_move() {
		if (!this.active) {
			return;
		}
		this.update_move();
		// commit movement
		this.tegaki.canvas_ctx.clearRect(
			0,
			0,
			this.tegaki.canvas.width,
			this.tegaki.canvas.height
		);
		this.tegaki.canvas_ctx.globalCompositeOperation = 'source-over';
		this.tegaki.canvas_ctx.drawImage(this.cut_from, 0, 0);
		this.tegaki.canvas_ctx.drawImage(this.floating, 0, 0);
		if (this.tegaki.selection.active) {
			// move selection
			this.tegaki.selection.move(this.end.x - this.start.x, this.end.y - this.start.y);
		}
		this.tegaki.selection.hide_ants = false;
		this.active = false;
		this.start.x = null;
		this.start.y = null;
		this.end.x = null;
		this.end.y = null;
	}
	discard_move() {
		this.tegaki.selection.hide_ants = false;
		this.active = false;
		this.start.x = null;
		this.start.y = null;
		this.end.x = null;
		this.end.y = null;
	}
}

export class Marquee extends Tool {
	constructor(tegaki) {
		super(tegaki);
		this.name = 'marquee';
		this.active = false;
		this.start = {
			x: null,
			y: null,
		};
		this.end = {
			x: null,
			y: null,
		};
	}
	input_press(type) {
		this.tegaki.clear_display();
		this.tegaki.draw_to_display(this.tegaki.canvas);
		// right click cancels marquee
		if ('m2' == type) {
			if (this.active) {
				this.discard_marquee();
			}
			return;
		}
		this.start_marquee();
	}
	input_release(x, y) {
		this.tegaki.clear_display();
		this.tegaki.draw_to_display(this.tegaki.canvas);
		this.end_marquee();
	}
	input_move() {
		this.tegaki.clear_display();
		this.tegaki.draw_to_display(this.tegaki.canvas);
		this.update_marquee();
	}
	start_marquee() {
		if (this.active) {
			return;
		}
		this.active = true;
		this.start.x = Math.floor(this.tegaki.cursor.canvas.x);
		this.start.y = Math.floor(this.tegaki.cursor.canvas.y);
		this.update_marquee();
	}
	update_marquee() {
		if (!this.active) {
			return;
		}
		this.end.x = Math.floor(this.tegaki.cursor.canvas.x);
		this.end.y = Math.floor(this.tegaki.cursor.canvas.y);
	}
	end_marquee() {
		if (!this.active) {
			return;
		}
		this.update_marquee();
		this.active = false;
		//this.start.x = null;
		//this.start.y = null;
		//this.end.x = null;
		//this.end.y = null;
	}
	discard_marquee() {
		this.active = false;
	}
}

export class SelectMarquee extends Marquee {
	constructor(tegaki) {
		super(tegaki);
		this.name = 'select_marquee';
		this.mode = 'replace';
		this.indicator = document.createElement('canvas');
		this.indicator.width = this.tegaki.canvas.width;
		this.indicator.height = this.tegaki.canvas.height;
		this.indicator_ctx = this.indicator.getContext('2d');
		this.tegaki.workspace.addEventListener('canvas-size-change', () => {
			this.indicator.width = this.tegaki.canvas.width;
			this.indicator.height = this.tegaki.canvas.height;
		});
	}
	update_marquee() {
		super.update_marquee();
		if (!this.active) {
			return;
		}
		this.dx = this.end.x - this.start.x;
		this.dy = this.end.y - this.start.y;
		//TODO draw selection edge around current selection
		//TODO indicator should be inverted 1px edge of rect
		this.indicator_ctx.clearRect(0, 0, this.indicator.width, this.indicator.height);
		this.indicator_ctx.fillStyle = 'rgba(127, 0, 127, 0.25)';
		this.indicator_ctx.fillRect(
			this.start.x,
			this.start.y,
			this.dx,
			this.dy
		);
		this.tegaki.clear_display();
		this.tegaki.draw_to_display(this.tegaki.canvas);
		this.tegaki.draw_to_display(this.indicator);
	}
	end_marquee() {
		if (!this.active) {
			return;
		}
		super.end_marquee();
		if (
			'replace' == this.mode
			&& this.start.x == this.end.x
			&& this.start.y == this.end.y
		) {
			this.tegaki.selection.deselect();
			return;
		}
		let canvas = document.createElement('canvas');
		canvas.width = this.tegaki.canvas.width;
		canvas.height = this.tegaki.canvas.height;
		let ctx = canvas.getContext('2d');
		ctx.fillStyle = 'rgba(0, 0, 0, 1)';
		ctx.fillRect(
			this.start.x,
			this.start.y,
			this.dx,
			this.dy
		);
		this.tegaki.selection['select_' + this.mode](canvas);
	}
	discard_marquee() {
		super.discard_marquee();
		this.tegaki.selection.active = false;
	}
}

//TODO export class SelectLasso extends Brush {}
//TODO export class SelectBrush extends Brush {}
//TODO export class Mosaic extends Marquee {}
//TODO export class Jumble extends Brush {}

// tones
export class Tones {
	constructor(tegaki) {
		this.tegaki = tegaki;
		this.tones = [];
		this.tones_by_name = {};
		this.current_tone = null;
		this.mask = document.createElement('canvas');
		this.mask.width = this.tegaki.canvas.width;
		this.mask.height = this.tegaki.canvas.height;
		this.mask_ctx = this.mask.getContext('2d');
		this.tegaki.workspace.addEventListener('canvas-size-change', () => {
			this.mask.width = this.tegaki.canvas.width;
			this.mask.height = this.tegaki.canvas.height;
			this.fill_mask();
		});
		this.tegaki.workspace.addEventListener('wipe', () => {
			this.current_tone = null;
		});
	}
	load(tones) {
		this.tones = this.tones.concat(tones);
		for (let i in tones) {
			let tone = tones[i];
			this.tones_by_name[tone.name] = tone;
			tone.canvas = document.createElement('canvas');
			tone.canvas.width = tone.edge;
			tone.canvas.height = tone.edge;
			tone.ctx = tone.canvas.getContext('2d');
			// build tone from data
			let image_data = tone.ctx.getImageData(
				0,
				0,
				tone.canvas.width,
				tone.canvas.height
			);
			let j = 0;
			for (let k = 0; k < image_data.data.length; k += 4) {
				if (0 < tone.data[j]) {
					image_data.data[k + 3] = tone.data[j] * 255;
				}
				j++;
			}
			tone.ctx.putImageData(image_data, 0, 0);
		}
		this.tegaki.workspace.dispatchEvent(new Event('tones-loaded'));
	}
	clear_tone() {
		if (this.current_tone) {
			this.tegaki.remove_mask(this.mask);
			this.current_tone = null;
		}
	}
	set_tone(tone=null) {
		this.clear_tone();
		this.current_tone = tone;
		this.fill_mask();
		this.tegaki.add_mask(this.mask);
		this.tegaki.workspace.dispatchEvent(new Event('tone-change'));
	}
	set_tone_by_index(tone_index) {
		if (0 > tone_index || this.tones.length - 1 < tone_index) {
			return;
		}
		this.set_tone(this.tones[tone_index]);
	}
	set_tone_by_name(tone_name) {
		if (!this.tones_by_name[tone_name]) {
			return;
		}
		this.set_tone(this.tones_by_name[tone_name]);
	}
	tile_tone(tone, canvas, ctx=null) {
		if (!ctx) {
			ctx = canvas.getContext('2d');
		}
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		for (let y = 0; y < canvas.height; y += tone.edge) {
			for (let x = 0; x < canvas.width; x += tone.edge) {
				ctx.drawImage(tone.canvas, x, y);
			}
		}
	}
	fill_mask() {
		if (!this.current_tone) {
			return;
		}
		this.tile_tone(this.current_tone, this.mask, this.mask_ctx);
	}
}

// selection
export class Selection {
	constructor(tegaki) {
		this.tegaki = tegaki;
		this.active = false;
		// selection
		this.selection = document.createElement('canvas');
		this.selection.width = this.tegaki.canvas.width;
		this.selection.height = this.tegaki.canvas.height;
		this.selection_ctx = this.selection.getContext('2d');
		// mask
		this.mask = document.createElement('canvas');
		this.mask.width = this.tegaki.canvas.width;
		this.mask.height = this.tegaki.canvas.height;
		this.mask_ctx = this.mask.getContext('2d');
		// ants
		this.rebuild_ants = false;
		this.hide_ants = false;
		this.ants_mask = document.createElement('canvas');
		this.ants_mask.width = this.tegaki.display.width;
		this.ants_mask.height = this.tegaki.display.height;
		this.ants_mask_ctx = this.ants_mask.getContext('2d');
		this.ants = document.createElement('canvas');
		this.ants.id = 'tegaki-selection-ants';
		this.ants.width = this.tegaki.display.width;
		this.ants.height = this.tegaki.display.height;
		this.ants_ctx = this.ants.getContext('2d');
		this.ants_diags = [];
		this.current_ants_diag = 0;
		this.build_ants_diags();
		this.tegaki.apparent.appendChild(this.ants);
		this.interval = setInterval(() => {
			if (this.hide_ants) {
				this.ants_ctx.clearRect(0, 0, this.ants.width, this.ants.height);
				return;
			}
			if (!this.active) {
				return;
			}
			if (this.rebuild_ants) {
				this.build_ants();
				this.rebuild_ants = false;
			}
			// draw ants mask to ants
			this.ants_ctx.drawImage(this.ants_mask, 0, 0);
			this.ants_ctx.globalCompositeOperation = 'source-in';
			this.ants_ctx.drawImage(this.ants_diags[this.current_ants_diag], 0, 0);
			this.current_ants_diag++;
			if (this.current_ants_diag > this.ants_diags.length - 1) {
				this.current_ants_diag = 0;
			}
		}, 150);
		// listeners
		this.tegaki.workspace.addEventListener('canvas-size-change', () => {
			this.selection.width = this.tegaki.canvas.width;
			this.selection.height = this.tegaki.canvas.height;
			this.mask.width = this.tegaki.canvas.width;
			this.mask.height = this.tegaki.canvas.height;
		});
		this.tegaki.workspace.addEventListener('wipe', () => {
			this.deselect();
		});
		this.tegaki.workspace.addEventListener('apparent-size-change', () => {
			if (!this.active) {
				return;
			}
			this.ants.width = this.tegaki.display.width;
			this.ants.height = this.tegaki.display.height;
			this.build_ants_diags();
			this.build_ants();
		});
		this.tegaki.workspace.addEventListener('select', () => {
			this.rebuild_ants = true;
		});
		this.tegaki.workspace.addEventListener('invert-selection', () => {
			this.rebuild_ants = true;
		});
		this.tegaki.workspace.addEventListener('flip', () => {
			if (!this.active) {
				return;
			}
			this.build_ants();
		});
	}
	deselect() {
		this.active = false;
		this.ants_ctx.clearRect(0,0, this.ants.width, this.ants.height);
		this.tegaki.remove_mask(this.mask);
		this.tegaki.workspace.dispatchEvent(new Event('deselect'));
	}
	invert(canvas) {
		let inverted = document.createElement('canvas');
		inverted.width = canvas.width;
		inverted.height = canvas.height;
		let inverted_ctx = inverted.getContext('2d');
		inverted_ctx.fillRect(0, 0, inverted.width, inverted.height);
		inverted_ctx.globalCompositeOperation = 'destination-out';
		inverted_ctx.drawImage(canvas, 0, 0);
		return inverted
	}
	select() {
		this.active = true;
		this.tegaki.add_mask(this.mask);
		this.tegaki.workspace.dispatchEvent(new Event('select'));
	}
	select_replace(canvas) {
		this.selection_ctx.globalCompositeOperation = 'copy';
		this.selection_ctx.drawImage(canvas, 0, 0);
		this.mask_ctx.globalCompositeOperation = 'copy';
		this.mask_ctx.drawImage(this.invert(canvas), 0, 0);
		this.select();
	}
	select_add(canvas) {
		this.selection_ctx.globalCompositeOperation = 'source-over';
		this.selection_ctx.drawImage(canvas, 0, 0);
		this.mask_ctx.globalCompositeOperation = 'source-over';
		this.mask_ctx.drawImage(this.invert(canvas), 0, 0);
		this.select();
	}
	select_remove(canvas) {
		this.selection_ctx.globalCompositeOperation = 'destination-out';
		this.selection_ctx.drawImage(canvas, 0, 0);
		this.mask_ctx.globalCompositeOperation = 'destination-out';
		this.mask_ctx.drawImage(this.invert(canvas), 0, 0);
		this.select();
	}
	move(dx, dy) {
		this.selection_ctx.globalCompositeOperation = 'copy';
		this.selection_ctx.drawImage(this.invert(this.mask), dx, dy);
		this.mask_ctx.globalCompositeOperation = 'copy';
		this.mask_ctx.drawImage(this.invert(this.selection), 0, 0);
		this.select();
	}
	invert_selection() {
		if (!this.active) {
			return;
		}
		// actually copy contents to preserve canvas references
		let selection = document.createElement('canvas');
		selection.width = this.selection.width;
		selection.height = this.selection.height;
		let selection_ctx = selection.getContext('2d');
		selection_ctx.globalCompositeOperation = 'copy';
		selection_ctx.drawImage(this.selection, 0, 0);
		this.selection_ctx.globalCompositeOperation = 'copy';
		this.selection_ctx.drawImage(this.mask, 0, 0);
		this.mask_ctx.globalCompositeOperation = 'copy';
		this.mask_ctx.drawImage(selection, 0, 0);
		this.build_ants();
		this.tegaki.workspace.dispatchEvent(new Event('invert-selection'));
	}
	crop_to_selection() {
		if (!this.active) {
			console.log('No selection to crop to');
			return 1;
		}
		let temp = document.createElement('canvas');
		temp.width = this.tegaki.canvas.width;
		temp.height = this.tegaki.canvas.height;
		let temp_ctx = temp.getContext('2d');
		temp_ctx.drawImage(this.tegaki.canvas, 0, 0);
		temp_ctx.globalCompositeOperation = 'destination-in';
		temp_ctx.drawImage(this.selection, 0, 0);
		// determine content bounds
		let first_y = null;
		let first_x = null;
		let last_y = null;
		let last_x = null;
		let image_data = temp_ctx.getImageData(0, 0, temp.width, temp.height);
		for (let y = 0; y < temp.height; y++) {
			let row_empty = true;
			let first_in_row = null;
			let last_in_row = null;
			for (let x = 0; x < temp.width; x++) {
				let index = (y * temp.width * 4) + (x * 4);
				if (0 == image_data.data[index + 3]) {
					continue;
				}
				row_empty = false;
				if (null == first_in_row) {
					first_in_row = x;
					if (null == first_x) {
						first_x = first_in_row;
					}
					first_x = Math.min(first_x, first_in_row);
				}
				else {
					last_in_row = x;
					if (null == last_x) {
						last_x = last_in_row;
					}
					last_x = Math.max(last_x, last_in_row);
				}
			}
			if (!row_empty) {
				if (null == first_y) {
					first_y = y;
				}
			}
			else if (null != first_y && null == last_y) {
				last_y = y;
			}
		}
		// resize canvas to selection size
		let width = last_x - first_x;
		let height = last_y - first_y;
		if (0 == width || 0 == height) {
			console.log('Selection contained no drawing');
			return 2;
		}
		this.tegaki.push_undo_resize(
			this.tegaki.canvas.width,
			this.tegaki.canvas.height,
			width,
			height
		);
		this.tegaki.set_canvas_size(width, height);
		this.tegaki.canvas_ctx.clearRect(
			0,
			0,
			this.tegaki.canvas.width,
			this.tegaki.canvas.height
		);
		// copy selected area
		this.tegaki.canvas_ctx.globalCompositeOperation = 'source-over';
		this.tegaki.canvas_ctx.drawImage(
			temp,
			first_x,
			first_y,
			this.tegaki.canvas.width,
			this.tegaki.canvas.height,
			0,
			0,
			this.tegaki.canvas.width,
			this.tegaki.canvas.height
		);
		this.deselect();
		this.tegaki.draw_to_display(this.tegaki.canvas);
		this.tegaki.workspace.dispatchEvent(new Event('crop-to-selection'));
		return 0;
	}
	build_ants_diags() {
		let tile_edge = 6;
		let stripes = [
			[
				0,0,0,1,1,1,
				0,0,1,1,1,0,
				0,1,1,1,0,0,
				1,1,1,0,0,0,
				1,1,0,0,0,1,
				1,0,0,0,1,1,
			],
			[
				0,0,1,1,1,0,
				0,1,1,1,0,0,
				1,1,1,0,0,0,
				1,1,0,0,0,1,
				1,0,0,0,1,1,
				0,0,0,1,1,1,
			],
			[
				0,1,1,1,0,0,
				1,1,1,0,0,0,
				1,1,0,0,0,1,
				1,0,0,0,1,1,
				0,0,0,1,1,1,
				0,0,1,1,1,0,
			],
			[
				1,1,1,0,0,0,
				1,1,0,0,0,1,
				1,0,0,0,1,1,
				0,0,0,1,1,1,
				0,0,1,1,1,0,
				0,1,1,1,0,0,
			],
			[
				1,1,0,0,0,1,
				1,0,0,0,1,1,
				0,0,0,1,1,1,
				0,0,1,1,1,0,
				0,1,1,1,0,0,
				1,1,1,0,0,0,
			],
			[
				1,0,0,0,1,1,
				0,0,0,1,1,1,
				0,0,1,1,1,0,
				0,1,1,1,0,0,
				1,1,1,0,0,0,
				1,1,0,0,0,1,
			],
		];
		for (let i = 0; i < stripes.length; i++) {
			let stripe = stripes[i];
			let tile = document.createElement('canvas');
			tile.width = tile_edge;
			tile.height = tile_edge;
			let tile_ctx = tile.getContext('2d');
			let image_data = tile_ctx.createImageData(
				tile.width,
				tile.height
			);
			for (let j = 0; j < stripe.length; j++) {
				let value = 0;
				if (1 == stripe[j]) {
					value = 255;
				}
				let index = j * 4;
				image_data.data[index] = value;
				image_data.data[index + 1] = value;
				image_data.data[index + 2] = value;
				image_data.data[index + 3] = 255;
			}
			tile_ctx.putImageData(image_data, 0, 0);
			let canvas = document.createElement('canvas');
			canvas.width = this.tegaki.display.width;
			canvas.height = this.tegaki.display.height;
			let ctx = canvas.getContext('2d');
			for (let j = 0; j < canvas.height; j += tile.height) {
				for (let k = 0; k < canvas.width; k += tile.width) {
					ctx.drawImage(tile, k, j);
				}
			}
			this.ants_diags[i] = canvas;
		}
	}
	build_ants() {
		this.ants_mask.width = this.tegaki.display.width;
		this.ants_mask.height = this.tegaki.display.height;
		this.ants.width = this.tegaki.display.width;
		this.ants.height = this.tegaki.display.height;
		if (this.tegaki.flipped) {
			this.ants_mask_ctx.save();
			this.ants_mask_ctx.translate(this.ants_mask.width, 0);
			this.ants_mask_ctx.scale(-1, 1);
		}
		else {
			this.ants_mask_ctx.restore();
		}
		// ants outline
		this.ants_mask_ctx.imageSmoothingEnabled = false;
		this.ants_mask_ctx.drawImage(
			this.selection,
			0,
			0,
			this.ants_mask.width,
			this.ants_mask.height
		);
		let image_data = this.ants_mask_ctx.getImageData(
			0,
			0,
			this.ants_mask.width,
			this.ants_mask.height
		);
		erase_image_data_interior(image_data);
		this.ants_mask_ctx.putImageData(image_data, 0, 0);
	}
}

// tegaki
export class Tegaki {
	constructor(width=512, height=256, check_safety=true) {
		this.version = '0.1.4';
		// workspace
		this.workspace = document.createElement('div');
		this.workspace.id = 'tegaki-workspace';
		window.addEventListener('resize', e => {
			this.window_resize();
			this.center();
		});
		this.window_resize();
		// disable context menu
		this.workspace.oncontextmenu = () => {
			return false;
		};
		// cursor
		this.cursor = {
			workspace: {
				x: 0,
				y: 0,
			},
			canvas: {
				x: 0,
				y: 0,
			},
		};
		// flipped
		this.flipped = false;
		this.workspace.dataset.flipped = this.flipped;
		// zoom
		this.zoom = 1;
		this.zoom_steps = [
			0.05,
			0.1,
			0.25,
			0.33,
			0.5,
			0.66,
			0.75,
			1,
			1.25,
			1.50,
			2,
			2.5,
			3.25,
			4,
			5,
			6,
			8,
			10,
			15,
			20,
		];
		//TODO manual zoom increment?
		// focus
		this.focus = {
			x: 1,
			y: 1,
		};
		// color picker //TODO custom color picker
		this.picker = new SystemColorPicker(this);
		// undo/redo
		this.undo_history = [];
		this.redo_history = [];
		this.update_workspace_history_available();
		// masks
		this.masks = [];
		// paper
		this.paper = document.createElement('canvas');
		this.paper.width = 2;
		this.paper.height = 2;
		this.paper.id = 'tegaki-paper';
		this.paper_ctx = this.paper.getContext('2d');
		this.paper_color = {
			r: 255,
			g: 255,
			b: 255,
			a: 1,
		};
		this.workspace.addEventListener('background-change', () => {
			this.set_paper_color(
				this.picker.background.r,
				this.picker.background.g,
				this.picker.background.b,
				this.picker.background.a
			);
		});
		this.workspace.dispatchEvent(new Event('background-change'));
		// canvas
		this.canvas = document.createElement('canvas');
		this.canvas.width = 2;
		this.canvas.height = 2;
		this.canvas.id = 'tegaki-canvas';
		this.canvas_ctx = this.canvas.getContext('2d');
		// overlay
		this.overlay = document.createElement('canvas');
		this.overlay.width = 2;
		this.overlay.height = 2;
		this.overlay.id = 'tegaki-overlay';
		this.overlay_ctx = this.overlay.getContext('2d');
		// display
		this.display = document.createElement('canvas');
		this.display.width = 2;
		this.display.height = 2;
		this.display.id = 'tegaki-display';
		this.display_ctx = this.display.getContext('2d');
		// apparent container
		this.apparent = document.createElement('div');
		this.apparent.id = 'tegaki-apparent';
		this.apparent.appendChild(this.paper);
		this.apparent.appendChild(this.display);
		this.apparent.appendChild(this.overlay);
		this.workspace.appendChild(this.apparent);
		// canvas size and center
		this.set_canvas_size(width, height);
		this.center();
		// tones
		this.tones = new Tones(this);
		// selection
		this.selection = new Selection(this);
		// tools
		this.tools = {
			hand: new Hand(this),
			magnifier: new Magnifier(this),
			draw: new Draw(this),
			erase: new Erase(this),
			eyedropper: new Eyedropper(this),
			fill: new Fill(this),
			move: new Move(this),
			select_marquee: new SelectMarquee(this),
			//TODO select
			//TODO mosaic
			//TODO jumble
		};
		this.previous_tool = this.tools['hand'];
		this.set_current_tool(this.tools['draw']);
		// default draw and erase
		this.tools.draw.set_size(1);
		this.tools.erase.set_size(5);
		// mouse listeners
		this.workspace.addEventListener('mousedown', e => {
			this.calculate_workspace_cursor(e.pageX, e.pageY);
			this.calculate_canvas_cursor();
			this.input_press('m' + e.button);
		});
		this.workspace.addEventListener('mouseup', e => {
			this.calculate_workspace_cursor(e.pageX, e.pageY);
			this.calculate_canvas_cursor();
			this.input_release('m' + e.button);
		});
		this.workspace.addEventListener('mousemove', e => {
			this.calculate_workspace_cursor(e.pageX, e.pageY);
			this.calculate_canvas_cursor();
			this.input_move();
		});
		// listeners for touch
		this.multitouch = false;
		this.touches = [];
		this.workspace.addEventListener('touchstart', e => {
			e.preventDefault();
			for (let i = 0; i < e.changedTouches.length; i++) {
				this.touches.push(e.changedTouches[i]);
			}
			if (1 < this.touches.length) {
				this.multitouch = true;
				this.workspace.dispatchEvent(new Event('multitouch-start'));
			}
			// treat first touch as m0
			this.calculate_workspace_cursor(
				e.touches[0].pageX,
				e.touches[0].pageY
			);
			this.calculate_canvas_cursor();
			this.input_press('m0');
		});
		this.workspace.addEventListener('touchend', e => {
			e.preventDefault();
			let remove = [];
			for (let i = 0; i < e.changedTouches.length; i++) {
				for (let j = 0; j < this.touches.length; j++) {
					if (this.touches[j].identifier == e.changedTouches[i].identifier) {
						remove.push(this.touches[j]);
					}
				}
			}
			for (let i in remove) {
				this.touches.splice(this.touches.indexOf(remove[i]), 1);
			}
			if (2 > this.touches.length) {
				if (this.multitouch) {
					this.workspace.dispatchEvent(new Event('multitouch-end'));
				}
				this.multitouch = false;
			}
			this.input_release('m0');
		});
		this.workspace.addEventListener('touchmove', e => {
			e.preventDefault();
			this.calculate_workspace_cursor(
				e.touches[0].pageX,
				e.touches[0].pageY
			);
			for (let i = 0; i < e.changedTouches.length; i++) {
				for (let j = 0; j < this.touches.length; j++) {
					if (this.touches[j].identifier == e.changedTouches[i].identifier) {
						this.touches[j] = e.changedTouches[i];
					}
				}
			}
			this.calculate_canvas_cursor();
			this.input_move();
		});
		// arbitrary multitouch shortcut
		this.workspace.addEventListener('touchstart', e => {
			if (!this.multitouch) {
				return;
			}
			if (3 == this.touches.length) {
				this.undo();
			}
		});
		//TODO pinch zoom and canvas movement
		//TODO this is all pretty janky so i'm leaving it out for now
		this.pinch = {
			active: false,
			orig: {
				t0: null,
				t1: null,
				zoom: null,
				d: null,
				midpoint: {
					x: null,
					y: null,
				},
			},
			screen_division: 16,
		};
		this.workspace.addEventListener('multitouch-start', () => {
			this.pinch.active = true;
			//TODO pinch functions later
			return;
			let orig = this.touches.slice(0, 2);
			this.pinch.orig.t0 = orig[0];
			this.pinch.orig.t1 = orig[1];
			// get initial distance
			let dx = this.pinch.orig.t0.pageX - this.pinch.orig.t1.pageX;
			let dy = this.pinch.orig.t0.pageY - this.pinch.orig.t1.pageY;
			this.pinch.orig.d = Math.sqrt(dx * dx + dy * dy);
			this.pinch.orig.midpoint = {
				x: this.pinch.orig.t0.pageX + dx / 2,
				y: this.pinch.orig.t0.pageY + dy / 2,
			};
			this.pinch.orig.zoom = this.zoom;
			console.log('starting pinch');
			console.log(this.pinch);
			console.log(this.pinch.orig.t0.identifier);
			console.log(this.pinch.orig.t1.identifier);
		});
		this.workspace.addEventListener('multitouch-end', () => {
			this.pinch.active = false;
		});
		this.workspace.addEventListener('touchmove', e => {
			//TODO pinch functions later
			return;
			if (!this.pinch.active || 2 != this.touches.length) {
				return;
			}
			let t0 = this.pinch.orig.t0;
			let t1 = this.pinch.orig.t1;
			// if either of original 2 touches are no longer in this.touches then end pinch
			let still_holding_t0 = false;
			let still_holding_t1 = false;
			for (let i = 0; i < this.touches.length; i++) {
				if (t0.identifier == this.touches[i].identifier) {
					still_holding_t0 = true;
				}
				else if (t1.identifier == this.touches[i].identifier) {
					still_holding_t1 = true;
				}
			}
			if (!still_holding_t0 || !still_holding_t1) {
				this.pinch.active = false;
				return;
			}
			for (let i = 0; i < e.changedTouches.length; i++) {
				if (t0.identifier == e.changedTouches[i].identifier) {
					t0 = e.changedTouches[i];
				}
				else if (t1.identifier == e.changedTouches[i].identifier) {
					t1 = e.changedTouches[i];
				}
			}
			// new distance
			let dx = t0.pageX - t1.pageX;
			let dy = t0.pageY - t1.pageY;
			let d = Math.sqrt(dx * dx + dy * dy);
			// new midpoint
			let midpoint = {
				x: t0.pageX - dx / 2,
				y: t0.pageY - dy / 2,
			};
			// change in midpoints
			let mdx = midpoint.x - this.pinch.orig.midpoint.x;
			let mdy = midpoint.y - this.pinch.orig.midpoint.y;
			// adjust canvas offset
			this.tegaki.set_focus(
				this.pinch.orig.focus.x + mdx,
				this.pinch.orig.focus.y + mdy
			);
			// distance difference
			let dd = this.pinch.orig.d - d;
			// divide long edge of screen
			let zoom_threshold = Math.max(
				document.documentElement.clientWidth,
				document.documentElement.clientHeight
			) / this.pinch.screen_division;
			// do pinch zoom
			if (zoom_threshold < Math.abs(dd)) {
				// set to initial zoom
				this.set_zoom(this.pinch.orig.zoom);
				// zooming out
				if (0 < dd) {
					while (0 < dd) {
						this.zoom_out();
						dd -= zoom_threshold;
					}
				}
				// zooming in
				else if (0 > dd) {
					while (0 > dd) {
						this.zoom_in();
						dd += zoom_threshold;
					}
				}
			}
		});
		// safety
		if (
			check_safety
			&& localStorage.getItem('tegaki_safety')
			&& this.confirm(localization.confirm.safety_restore)
		) {
			this.safety_restore();
		}
		// start with empty undo history
		this.clear_undo_history();
	}
	alert(message) {
		//TODO custom alert, for now use browser
		alert(message);
	}
	confirm(message, options=[localization.confirm.yes, localization.confirm.no]) {
		//TODO custom confirm, for now use browser
		return confirm(message);
	}
	window_resize() {
		this.workspace.dataset.width = document.documentElement.clientWidth;
		this.workspace.dataset.height = document.documentElement.clientHeight;
		this.workspace.style.width = document.documentElement.clientWidth + 'px';
		this.workspace.style.height = document.documentElement.clientHeight + 'px';
	}
	set_canvas_size(width, height) {
		// copy canvas to temp
		let temp = document.createElement('canvas');
		temp.width = this.canvas.width;
		temp.height = this.canvas.height;
		let temp_ctx = temp.getContext('2d');
		temp_ctx.drawImage(this.canvas, 0, 0);
		// resize existing canvas
		this.canvas.width = width;
		this.canvas.height = height;
		// draw temp to existing canvas
		let temp_origin = {
			x: this.canvas.width / 2 - temp.width / 2,
			y: this.canvas.height / 2 - temp.height / 2,
		};
		this.canvas_ctx.drawImage(temp, temp_origin.x, temp_origin.y);
		this.set_apparent_size();
		this.workspace.dispatchEvent(new Event('canvas-size-change'));
		//TODO keep relative focus?
		//TODO for now just recenter
		this.center();
	}
	resize(width, height) {
		if (width < this.canvas.width || height < this.canvas.height) {
			if (!this.confirm(localization.confirm.resize)) {
				return;
			}
		}
		this.push_undo_resize(
			this.canvas.width,
			this.canvas.height,
			width,
			height
		);
		this.set_canvas_size(width, height);
		this.draw_to_display(this.canvas);
	}
	set_apparent_size() {
		let width = this.canvas.width * this.zoom;
		let height = this.canvas.height * this.zoom;
		// paper
		this.paper.width = width;
		this.paper.height = height;
		this.set_paper_color(
			this.paper_color.r,
			this.paper_color.g,
			this.paper_color.b,
			this.paper_color.a
		);
		// display
		this.display.width = width;
		this.display.height = height;
		if (this.flipped) {
			// resizing display canvas size will lose flip, so double flip to set it again
			this.flip();
			this.flip();
		}
		this.workspace.dispatchEvent(new Event('apparent-size-change'));
	}
	set_focus(x, y) {
		this.focus.x = x;
		this.focus.y = y;
		let left = (this.workspace.dataset.width / 2) + this.focus.x;
		let top = (this.workspace.dataset.height / 2) + this.focus.y;
		this.apparent.dataset.left = left;
		this.apparent.dataset.top = top;
		this.apparent.style.left = left + 'px';
		this.apparent.style.top = top + 'px';
	}
	set_zoom(zoom) {
		if (this.zoom == zoom) {
			return;
		}
		this.zoom = zoom;
		this.set_apparent_size();
		this.clear_display();
		this.draw_to_display(this.canvas);
		this.workspace.dispatchEvent(new Event('zoom-change'));
	}
	get_zoom_index() {
		let zoom_index = this.zoom_steps.indexOf(this.zoom)
		if (-1 != zoom_index) {
			return zoom_index;
		}
		if (this.zoom_steps[0] > this.zoom) {
			return 0;
		}
		let last_zoom = this.zoom_steps[0];
		for (let i in this.zoom_steps) {
			let zoom = this.zoom_steps[i];
			if (zoom > this.zoom) {
				let dup = zoom - this.zoom;
				let ddown = this.zoom - last_zoom;
				if (dup < ddown) {
					return i;
				}
				return i - 1;
			}
		}
		return this.zoom_steps.length - 1;
	}
	zoom_in() {
		let zoom_index = this.get_zoom_index();
		zoom_index += 1;
		if (this.zoom_steps.length <= zoom_index) {
			zoom_index = this.zoom_steps.length - 1;
		}
		this.set_zoom(this.zoom_steps[zoom_index]);
	}
	zoom_out() {
		let zoom_index = this.get_zoom_index();
		zoom_index -= 1;
		if (0 > zoom_index) {
			zoom_index = 0;
		}
		this.set_zoom(this.zoom_steps[zoom_index]);
	}
	center() {
		this.set_focus(
			this.zoom * this.canvas.width / -2,
			this.zoom * this.canvas.height / -2
		);
	}
	apply_masks(
		canvas,
		ctx=null,
		except=[],
		composite_operation='destination-out'
	) {
		if (!ctx) {
			ctx = canvas.getContext('2d');
		}
		ctx.globalCompositeOperation = composite_operation;
		for (let i in this.masks) {
			let mask = this.masks[i];
			if (-1 != except.indexOf(mask)) {
				continue;
			}
			ctx.drawImage(
				mask,
				0,
				0,
				canvas.width,
				canvas.height
			);
		}
	}
	clear(mode='in') {
		if ('out' == mode) {
			// clear outside with no selection does nothing
			if (!this.selection.active) {
				return;
			}
			this.canvas_ctx.globalCompositeOperation = 'destination-in';
		}
		else {
			// clear inside with no selection clears entire canvas
			if (!this.selection.active) {
				this.push_undo_canvas();
				this.canvas_ctx.clearRect(
					0,
					0,
					this.canvas.width,
					this.canvas.height
				);
				this.clear_display();
				this.safety_save();
				return;
			}
			this.canvas_ctx.globalCompositeOperation = 'destination-out';
		}
		this.push_undo_canvas();
		this.canvas_ctx.drawImage(this.selection.selection, 0, 0);
		this.clear_display();
		this.draw_to_display(this.canvas);
		this.safety_save();
	}
	clear_in() {
		this.clear();
	}
	clear_out() {
		this.clear('out');
	}
	set_paper_color(r, g, b, a) {
		this.paper_color.r = r;
		this.paper_color.g = g;
		this.paper_color.b = b;
		this.paper_color.a = a;
		this.paper_ctx.clearRect(
			0, 
			0, 
			this.paper.width, 
			this.paper.height
		);
		this.paper_ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
		this.paper_ctx.fillRect(
			0, 
			0, 
			this.paper.width, 
			this.paper.height
		);
		this.workspace.dispatchEvent(new Event('paper-color-change'));
	}
	swap_tool() {
		let current_tool = this.current_tool;
		this.set_current_tool(this.previous_tool);
		this.previous_tool = current_tool;
	}
	set_current_tool(tool) {
		this.current_tool = tool;
		this.workspace.dataset.currentTool = this.current_tool.name;
		this.workspace.dispatchEvent(new Event('current-tool-change'));
		for (let tool_name in this.tools) {
			this.tools[tool_name].current = false;
		}
		tool.current = true;
		if ('undefined' != typeof tool.size) {
			this.workspace.dataset.toolSize = tool.size;
		}
	}
	set_current_tool_by_name(tool_name) {
		this.set_current_tool(this.tools[tool_name]);
	}
	input_press(type) {
		if (this.current_tool.input_press) {
			this.current_tool.input_press(type);
		}
	}
	input_release(type) {
		if (this.current_tool.input_release) {
			this.current_tool.input_release(type);
		}
	}
	input_move() {
		if (this.current_tool.input_move) {
			this.current_tool.input_move();
		}
	}
	calculate_workspace_cursor(page_x, page_y) {
		//TODO calc for when workspace isn't full page
		this.cursor.workspace.x = page_x;
		this.cursor.workspace.y = page_y;
	}
	calculate_canvas_cursor() {
		//TODO check if this still works when workspace isn't full page
		this.cursor.canvas.x = (this.cursor.workspace.x - this.apparent.dataset.left) / this.zoom;
		this.cursor.canvas.y = (this.cursor.workspace.y - this.apparent.dataset.top) / this.zoom;
		if (this.flipped) {
			this.cursor.canvas.x = this.canvas.width - this.cursor.canvas.x
		}
	}
	clear_display() {
		this.display_ctx.clearRect(
			0,
			0,
			this.display.width,
			this.display.height
		);
	}
	draw_to_display(image) {
		this.display_ctx.imageSmoothingEnabled = false;
		this.display_ctx.drawImage(
			image,
			0,
			0,
			this.display.width,
			this.display.height
		);
	}
	safety_save() {
		localStorage.setItem('tegaki_safety', this.canvas.toDataURL());
		this.workspace.dispatchEvent(new Event('safety-save'));
	}
	safety_clear() {
		localStorage.removeItem('tegaki_safety');
		this.workspace.dispatchEvent(new Event('safety-clear'));
	}
	safety_restore() {
		let safety = localStorage.getItem('tegaki_safety');
		if (!safety) {
			console.log('No safety data to restore');
		}
		this.load_image(
			safety,
			(image) => {
				this.clear_display();
				this.set_canvas_size(image.width, image.height);
			},
			() => {
				this.clear_undo_history();
				this.workspace.dispatchEvent(new Event('safety-restore'));
			}
		);
	}
	flip() {
		this.flipped = !this.flipped;
		this.workspace.dataset.flipped = this.flipped;
		if (this.flipped) {
			this.display_ctx.save();
			this.display_ctx.translate(this.display.width, 0);
			this.display_ctx.scale(-1, 1);
		}
		else {
			this.display_ctx.restore();
		}
		this.clear_display();
		this.draw_to_display(this.canvas);
		this.workspace.dispatchEvent(new Event('flip'));
	}
	//TODO this undo/redo system isn't particularly memory friendly i guess
	//TODO make a better smarter undo/redo system later
	get_canvas_image_data() {
		return this.canvas_ctx.getImageData(
			0,
			0,
			this.canvas.width,
			this.canvas.height
		)
	}
	push_undo_state(type, data) {
		this.undo_history.push({
			type: type,
			data: data
		});
		//TODO if undo history size is larger than max undo levels
		//TODO then slice the earliest undo out of array
		this.update_workspace_history_available();
		this.workspace.dispatchEvent(new Event('push-undo-state'));
	}
	push_redo_state(type, data) {
		this.redo_history.push({
			type: type,
			data: data,
		});
		//TODO if redo history size is larger than max redo levels
		//TODO then slice the latest redo out of array
		this.update_workspace_history_available();
		this.workspace.dispatchEvent(new Event('push-undo-state'));
	}
	push_undo_canvas() {
		this.push_undo_state(
			'canvas',
			this.get_canvas_image_data()
		);
	}
	push_redo_canvas() {
		this.push_redo_state(
			'canvas',
			this.get_canvas_image_data()
		);
	}
	push_undo_resize(before_width, before_height, after_width, after_height) {
		this.push_undo_canvas();
		this.push_undo_state(
			'resize',
			{
				before: {
					width: before_width,
					height: before_height,
				},
				after: {
					width: after_width,
					height: after_height,
				},
			}
		);
	}
	push_redo_resize(before_width, before_height, after_width, after_height) {
		this.push_redo_canvas();
		this.push_redo_state(
			'resize',
			{
				before: {
					width: before_width,
					height: before_height,
				},
				after: {
					width: after_width,
					height: after_height,
				},
			}
		);
	}
	apply_state(state, redo=false, push_other=true) {
		let action = 'undo';
		let other = 'redo';
		if (redo) {
			action = 'redo';
			other = 'undo';
		}
		switch(state.type) {
			case 'resize':
				if (push_other) {
					this['push_' + other + '_resize'](
						state.data.after.width,
						state.data.after.height,
						state.data.before.width,
						state.data.before.height
					);
				}
				this.set_canvas_size(
					state.data.before.width,
					state.data.before.height
				);
				let canvas_state = this[action + '_history'].pop();
				this.apply_state(canvas_state, redo, false);
				break;
			case 'canvas':
				if (push_other) {
					this['push_' + other + '_canvas']();
				}
				this.canvas_ctx.putImageData(state.data, 0, 0);
				this.safety_save();
				this.clear_display();
				this.draw_to_display(this.canvas);
				break;
		}
	}
	undo() {
		if (1 > this.undo_history.length) {
			return false;
		}
		// unwind last undo state
		let state = this.undo_history.pop();
		this.apply_state(state);
		this.update_workspace_history_available();
		this.workspace.dispatchEvent(new Event('undo'));
		return true;
	}
	redo() {
		if (1 > this.redo_history.length) {
			return false;
		}
		// unwind last redo state and draw it to the canvas
		let state = this.redo_history.pop();
		this.apply_state(state, true);
		this.update_workspace_history_available();
		this.workspace.dispatchEvent(new Event('redo'));
		return true;
	}
	update_workspace_history_available() {
		this.workspace.dataset.undosAvailable = this.undo_history.length;
		this.workspace.dataset.redosAvailable = this.redo_history.length;
	}
	clear_undo_history() {
		this.undo_history = [];
		this.update_workspace_history_available();
	}
	get_presave_canvas() {
		let save = document.createElement('canvas');
		save.width = this.canvas.width;
		save.height = this.canvas.height;
		let save_ctx = save.getContext('2d');
		// fill bg with paper color
		save_ctx.fillStyle = 'rgba(' + this.paper_color.r + ','
			+ this.paper_color.g + ','
			+ this.paper_color.b + ','
			+ this.paper_color.a+ ')';
		save_ctx.fillRect(0, 0, save.width, save.height);
		// retain flipped for saving since it's probably what the user expects
		if (this.flipped) {
			save_ctx.translate(save.width, 0);
			save_ctx.scale(-1, 1);
		}
		// draw current canvas
		save_ctx.drawImage(this.canvas, 0, 0);
		return save;
	}
	save() {
		// trigger save prompt
		let link = document.createElement('a');
		link.href = this.get_presave_canvas().toDataURL();
		link.download = 'tegaki.' + new Date().getTime() + '.png';
		link.click();
	}
	_send() {
		// implement your own send handler outside of the tegaki class
		// usually getting the data url of the presave canvas
		// and then sending it to a recipient along with some identifying information
	}
	wipe() {
		if (!this.confirm(localization.confirm.wipe)) {
			return;
		}
		// clear canvas
		this.canvas_ctx.clearRect(
			0,
			0,
			this.canvas.width,
			this.canvas.height
		);
		// clear buffers
		this.undo_history = [];
		this.redo_history = [];
		this.update_workspace_history_available();
		// clear safety
		this.safety_clear();
		this.clear_display();
		this.draw_to_display(this.canvas)
		this.workspace.dispatchEvent(new Event('wipe'));
		// clear masks
		this.masks = [];
	}
	add_mask(canvas) {
		if (-1 != this.masks.indexOf(canvas)) {
			return this.masks.length - 1;
		}
		this.masks.push(canvas);
		return this.masks.length - 1;
	}
	remove_mask(mask) {
		this.remove_mask_by_index(this.masks.indexOf(mask));
	}
	remove_mask_by_index(index) {
		this.masks.splice(index, 1);
	}
	load_image(image_url, before_draw=null, after_draw=null) {
		let image = new Image();
		image.crossOrigin = 'anonymous';
		image.onload = () => {
			if (before_draw && 'function' == typeof before_draw) {
				before_draw(image);
			}
			this.canvas_ctx.drawImage(image, 0, 0);
			if (after_draw && 'function' == typeof after_draw) {
				after_draw(image);
			}
			this.draw_to_display(this.canvas);
		};
		image.src = image_url;
	};
}
