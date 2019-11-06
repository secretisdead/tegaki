# Help

## Basic usage

Press primary mouse button to draw. Pressing secondary mouse button while holding a stroke will cancel that stroke.

Mouse wheel to zoom in and out.

A safety save is stored if you have cookies and localStorage enabled, and if you leave the page you will be prompted to restore (without undo history) when returning.

## Mobile usage

Touch to draw. Touching a second finger while holding a stroke will cancel that stroke.

Touch three fingers at once to undo.

## Keyboard shortcuts

These are static right now. Eventually I'll add a nice interface for the user to rebind these, and have them remain in localstorage once they've been changed.

### Tools

| Description | Key |
| ----------- | --- |
| Hand        | L   |
| Magnifier   | M   |
| Draw        | B   |
| Erase       | E   |
| Eyedropper  | I   |
| Fill        | F   |

### Actions

| Description                      | Key         |
| -------------------------------- | ----------- |
| Flip display canvas horizontally | H           |
| Undo                             | Ctrl+Z      |
| Redo                             | Ctrl+Y      |
| Save                             | Ctrl+S      |
| Send                             | Ctrl+U      |
| Clear inside selected area       | Delete      |
| Clear outside selected area      | Ctrl+Delete |
| Wipe                             | Escape      |

### Palette

| Description                      | Key    |
| -------------------------------- | ------ |
| Open picker for foreground color | Ctrl+F |
| Open picker for background color | Ctrl+B |

### Tool properties

| Description         | Key   |
| ------------------- | ----- |
| Brush shape square  | Alt+S |
| Brush shape round   | Alt+R |
| Brush size decrease | A     |
| Brush size increase | S     |

### Headless

| Description | Key |
| ----------- | --- |
| Swap tool   | X   |

### Temp tools

Switch to a tool only while holding the shortcut key and return to the previous tool when the shortcut key is released

| Description | Key      |
| ----------- | -------- |
| Hand        | Spacebar |
| Eyedropper  | Alt      |
| Move        | Ctrl     |

### Advanced settings

Some miscellaneous advanced settings can be accessed by clicking the settings icon in the lower right corner.

The type of stroke interpolation and anti-aliasing can be changed in the advanced settings menu (until they become integrated into the brush tool properties in the main menu as stabilizer and softness).

The canvas dimensions can also be changed in the advanced settings menu.
