'use strict';

export let localization = {
	confirm: {
		yes: 'Yes',
		no: 'No',
		resize: 'Requested canvas size is smaller than current canvas.\n'
			+ 'Some parts of the current canvas may be lost.\n'
			+ 'Continue?',
		safety_restore: 'Restore last open canvas?',
		wipe: 'This will wipe event, undo, and safety save data. Continue?',
	},
	tool_buttons: {
		hand: {
			text: 'Hand',
			tip: 'Move the canvas within the workspace',
		},
		magnifier: {
			text: 'Magnifier',
			tip: 'Zoom in and out on the canvas',
		},
		draw: {
			text: 'Draw',
			tip: 'Draw on the canvas',
		},
		erase: {
			text: 'Erase',
			tip: 'Erase from the canvas',
		},
		eyedropper: {
			text: 'Eyedropper',
			tip: 'Pick a color from the canvas',
		},
		fill: {
			text: 'Fill',
			tip: 'Fill an area of the canvas',
		},
		move: {
			text: 'Move',
			tip: 'Move an area of the canvas',
		},
		select_marquee: {
			text: 'Select',
			tip: 'Select an area of the canvas',
		},
		mosaic: {
			text: 'Mosaic',
			tip: 'Mosaic an area of the canvas',
		},
		jumble: {
			text: 'Jumble',
			tip: 'Jumble pixels on the canvas',
		},
	},
	action_buttons: {
		flip: {
			text: 'Flip',
			tip: 'Flip the display canvas horizontally',
		},
		undo: {
			text: 'Undo',
			tip: 'Undo the last action',
		},
		redo: {
			text: 'Redo',
			tip: 'Redo the last undone action',
		},
		save: {
			text: 'Save',
			tip: 'Save your drawing',
		},
		send: {
			text: 'Send',
			tip: 'Send your drawing',
			alert: 'This is the default send handler, '
				+ 'it\'s not hooked up to anything.',
		},
		clear_in: {
			text: 'Clear',
			tip: 'Clear inside selected area',
		},
		clear_out: {
			text: 'Clear out',
			tip: 'Clear outside selected area',
		},
		invert_selection: {
			text: 'Invert selection',
			tip: 'Invert the selected area',
		},
		wipe: {
			text: 'Wipe',
			tip: 'Wipe event, undo, and safety save data',
		},
	},
	palette: {
		current: {
			foreground: 'Foreground color',
			background: 'Background color',
		},
	},
	properties: {
		tone_indicator: 'Current tone',
		brush: {
			shape_buttons: {
				square: {
					text: 'Square',
					tip: 'Square brush',
				},
				round: {
					text: 'Round',
					tip: 'Round brush',
				},
			},
			size: {
				range: 'Brush size',
				increase: 'Increase brush size',
				decrease: 'Decrease brush size',
			},
		},
	},
	selection_action_buttons: {
		deselect: {
			text: 'Deselect',
			tip: 'Deselect',
		},
		invert_selection: {
			text: 'Invert',
			tip: 'Invert selection',
		},
		crop_to_selection: {
			text: 'Crop',
			tip: 'Crop to selection',
			alert: {
				no_selection: 'No selection to crop to',
				no_data: 'Selection contained no drawing',
			},
		},
	},
	status: {
		boxes: {
			coordinates: 'Canvas coordinates',
			zoom: 'Canvas zoom',
		},
		buttons: {
			zoom_out: {
				text: 'Zoom out',
				tip: 'Zoom out',
			},
			zoom_in: {
				text: 'Zoom in',
				tip: 'Zoom in',
			},
			help: {
				text: 'Help',
				tip: 'Help',
			},
			fullscreen: {
				text: 'Fullscreen',
				tip: 'Toggle fullscreen',
			},
			settings: {
				text: 'Settings',
				tip: 'Settings',
			},
		},
	},
	tones: {
		clear: 'Solid',
	},
};
