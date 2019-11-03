# package the tegaki and all support files into a single 
# self-contained html file named tegaki-X.Y.Z.html in the build directory

import os
import re
import base64

scripts_path = os.path.dirname(os.path.realpath(__file__))
repo_path = os.path.join(scripts_path, os.pardir)

src_path = os.path.join(repo_path, 'src')
build_path = os.path.join(repo_path, 'build')

# remove import lines from html and js contents
def remove_imports(contents):
	return re.sub(
		'import.+;',
		'',
		contents
	)

# index
index_file_path = os.path.join(src_path, 'index.html')
# get contents
file = open(index_file_path, 'r')
index_file_contents = file.read().replace('\\', '\\\\')
file.close()
# remove stylesheet links
index_file_contents = re.sub(
	'\<link rel\="stylesheet" href\=".+"\>',
	'',
	index_file_contents
)
# insert <style type="text/css"></style> before <script type="module">
index_file_contents = re.sub(
	'\<script type\="module"\>',
	'<style type="text/css"></style><script type="module">',
	index_file_contents
)
# remove imports
index_file_contents = remove_imports(index_file_contents)
# insert script anchor after <script type="module">
index_file_contents = re.sub(
	'<script type="module">',
	'<script type="module">\nSCRIPT_ANCHOR',
	index_file_contents,
)

# tones
tones_path = os.path.join(src_path, 'tones')
tone_filenames = []
for (_, _, filenames) in os.walk(tones_path):
	tone_filenames.extend(filenames)
	break
# remove hardcoded tone loads
index_file_contents = re.sub(
	'tegaki.tones.load(.+);',
	'',
	index_file_contents,
)
# insert tones anchor after // tones
index_file_contents = re.sub(
	'// tones',
	'// tones\nTONES_ANCHOR',
	index_file_contents,
)
for filename in tone_filenames:
	# get name
	tone_name = filename[0:filename.find('.')]
	# get contents
	file = open(os.path.join(tones_path, filename), 'r')
	contents = file.read().replace('\\', '\\\\')
	file.close()
	# replace identifier
	contents = re.sub(
		'export let tones =',
		'export let tones_' + tone_name + ' =',
		contents,
	)
	# insert contents before SCRIPT_ANCHOR
	index_file_contents = re.sub(
		'SCRIPT_ANCHOR',
		contents + 'SCRIPT_ANCHOR',
		index_file_contents,
	)
	# add load tone lines to before '// tones'
	index_file_contents = re.sub(
		'TONES_ANCHOR',
		'tegaki.tones.load(tones_' + tone_name + ');\nTONES_ANCHOR',
		index_file_contents,
	)
# remove tones anchor
index_file_contents = re.sub(
	'TONES_ANCHOR',
	'',
	index_file_contents,
)

# version
version = ''

# scripts
script_file_paths = {
	'localization': os.path.join(src_path, 'localization.js'),
	'tegaki': os.path.join(src_path, 'tegaki.js'),
	'interface': os.path.join(src_path, 'interface.js'),
	'shortcuts': os.path.join(src_path, 'shortcuts.js'),
}
for (name, path) in script_file_paths.items():
	# get contents
	file = open(path, 'r')
	contents = file.read().replace('\\', '\\\\')
	file.close()
	# tegaki.js
	if 'tegaki' == name:
		# get version
		matches = re.search(
			"this.version = '(?P<version>.+)'",
			contents
		)
		version = matches.groupdict()['version']

	# remove imports
	contents = remove_imports(contents)

	# insert contents before SCRIPT_ANCHOR
	index_file_contents = re.sub(
		'SCRIPT_ANCHOR',
		contents + '\nSCRIPT_ANCHOR',
		index_file_contents,
	)
# remove script anchor
index_file_contents = re.sub(
	'SCRIPT_ANCHOR',
	'',
	index_file_contents,
)

# images
image_file_paths = {
	'workspace_background': os.path.join(src_path, 'workspace_background.png'),
	'transparent': os.path.join(src_path, 'transparent.png'),
	'ui': os.path.join(src_path, 'ui.png'),
	'eyedropper.cursor': os.path.join(src_path, 'eyedropper.cursor.png'),
	'fill.cursor': os.path.join(src_path, 'fill.cursor.png'),
	'hand.cursor': os.path.join(src_path, 'hand.cursor.png'),
	'magnifier.cursor': os.path.join(src_path, 'magnifier.cursor.png'),
}
base64_images = {}
for (name, path) in image_file_paths.items():
	# get contents
	file = open(r"" + path, 'rb')
	contents = file.read()
	file.close()
	# encode as base64
	encoded = base64.b64encode(contents)
	#encoded = 'data:image/png;base64,test-' + name
	base64_images[name] = encoded

# styles
style_file_paths = {
	'tegaki': os.path.join(src_path, 'tegaki.css'),
	'interface': os.path.join(src_path, 'interface.css'),
	'input_range': os.path.join(src_path, 'input_range.css'),
}
for (name, path) in style_file_paths.items():
	# get contents
	file = open(path, 'r')
	contents = file.read().replace('\\', '\\\\')
	file.close()
	# replace image urls in style files with base64_url versions
	for (image_name, base64) in base64_images.items():
		contents = re.sub(
			'./' + image_name + '.png',
			'data:image/png;base64,' + base64_images[image_name].decode('utf-8'),
			contents,
		)
	# insert contents before </style>
	index_file_contents = re.sub(
		'</style>',
		contents + '\n</style>',
		index_file_contents,
	)

# remove tabs from lines with only tabs
index_file_contents = re.sub(
	'^(\t*)$',
	'',
	index_file_contents,
	flags=re.MULTILINE
)

# save
output_file_path = os.path.join(build_path, 'tegaki-' + version + '.html')
file = open(output_file_path, 'w')
file.write(index_file_contents)
file.close()
