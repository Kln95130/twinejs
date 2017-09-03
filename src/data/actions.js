/*
Vuex actions that components can use.
*/

const jsonp = require('jsonp');
const semverUtils = require('semver-utils');
const linkParser = require('./link-parser');
const locale = require('../locale');
const rect = require('../common/rect');

/*
Returns the latest story format version available, indexed by format name and
major version (as a string, not a number).
*/

function latestFormatVersions(store) {
	const latestVersions = {};

	store.state.storyFormat.formats.forEach(format => {
		if (!format.version) {
			return;
		}

		const v = semverUtils.parse(format.version);

		if (latestVersions[format.name]) {
			const existing = latestVersions[format.name][v.major];

			if (!existing ||
				v.minor > existing.minor ||
				v.minor === existing.minor && v.patch > existing.patch) {
				latestVersions[format.name][v.major] = v;
			}
		}
		else {
			latestVersions[format.name] = {};
			latestVersions[format.name][v.major] = v;
		}
	});

	return latestVersions;
}

const actions = module.exports = {
	setPref({ dispatch }, name, value) {
		dispatch('UPDATE_PREF', name, value);
	},

	createStory(store, props) {
		let normalizedProps = Object.assign({}, props);

		/* If a format isn't specified, use the default one. */

		if (!normalizedProps.storyFormat) {
			normalizedProps.storyFormat = store.state.pref.defaultFormat.name;
			normalizedProps.storyFormatVersion =
				store.state.pref.defaultFormat.version;
		}

		store.dispatch('CREATE_STORY', normalizedProps);
	},

	updateStory({ dispatch }, id, props) {
		dispatch('UPDATE_STORY', id, props);
	},

	deleteStory({ dispatch }, id) {
		dispatch('DELETE_STORY', id);
	},

	duplicateStory({ dispatch }, id, newName) {
		dispatch('DUPLICATE_STORY', id, newName);
	},

	importStory({ dispatch }, toImport) {
		dispatch('IMPORT_STORY', toImport);
	},

	createPassageInStory({ dispatch }, storyId, props) {
		dispatch('CREATE_PASSAGE_IN_STORY', storyId, props);
	},

	updatePassageInStory({ dispatch }, storyId, passageId, props) {
		dispatch('UPDATE_PASSAGE_IN_STORY', storyId, passageId, props);
	},

	deletePassageInStory({ dispatch }, storyId, passageId) {
		dispatch('DELETE_PASSAGE_IN_STORY', storyId, passageId);
	},

	setTagColorInStory(store, storyId, tagName, tagColor) {
		const story = store.state.story.stories.find(
			story => story.id == storyId
		);
		let toMerge = {};

		toMerge[tagName] = tagColor;

		if (!story) {
			throw new Error(`No story exists with id ${storyId}`);
		}

		store.dispatch(
			'UPDATE_STORY',
			storyId,
			{ tagColors: Object.assign({}, story.tagColors, toMerge) }
		);
	},

	/*
	Removes any unused tag colors from a story.
	*/

	cleanUpTagColorsInStory(store, storyId) {
		let story = store.state.story.stories.find(
			story => story.id == storyId
		);
		let tagColors = Object.assign({}, story.tagColors);

		if (!story) {
			throw new Error(`No story exists with id ${storyId}`);
		}

		Object.keys(tagColors).forEach(tag => {
			if (story.passages.some(p => p.tags.indexOf(tag) !== -1)) {
				return;
			}

			delete tagColors[tag];
		});

		store.dispatch('UPDATE_STORY', storyId, { tagColors });
	},

	/*
	Moves a passage so it doesn't overlap any other in its story, and also
	snaps to a grid.
	*/

	positionPassage(store, storyId, passageId, gridSize, filter) {
		if (gridSize && typeof gridSize !== 'number') {
			throw new Error('Asked to snap to a non-numeric grid size: ' + gridSize);
		}

		const story = store.state.story.stories.find(
			story => story.id == storyId
		);

		if (!story) {
			throw new Error(`No story exists with id ${storyId}`);
		}

		const passage = story.passages.find(
			passage => passage.id == passageId
		);

		if (!passage) {
			throw new Error(
				`No passage exists in this story with id ${passageId}`
			);
		}

		/* Displace by other passages. */

		let passageRect = {
			top: passage.top,
			left: passage.left,
			width: passage.width,
			height: passage.height
		};

		story.passages.forEach(other => {
			if (other === passage || (filter && !filter(other))) {
				return;
			}

			const otherRect = {
				top: other.top,
				left: other.left,
				width: other.width,
				height: other.height
			};

			if (rect.intersects(otherRect, passageRect)) {
				rect.displace(passageRect, otherRect, 10);
			}
		});

		/* Snap to the grid. */

		if (story.snapToGrid && gridSize && gridSize !== 0) {
			passageRect.left = Math.round(passageRect.left / gridSize) *
				gridSize;
			passageRect.top = Math.round(passageRect.top / gridSize) *
				gridSize;
		}

		/* Save the change. */

		actions.updatePassageInStory(
			store,
			storyId,
			passageId,
			{
				top: passageRect.top,
				left: passageRect.left
			}
		);
	},

	/*
	Adds new passages to a story based on new links added in a passage's text.
	*/

	createNewlyLinkedPassages(store, storyId, passageId, oldText, gridSize) {
		const story = store.state.story.stories.find(
			story => story.id === storyId
		);
		const passage = story.passages.find(
			passage => passage.id === passageId
		);

		/* Determine how many passages we'll need to create. */

		const oldLinks = linkParser(oldText, true);
		const newLinks = linkParser(passage.text, true).filter(
			link => (oldLinks.indexOf(link) === -1) &&
				!(story.passages.some(passage => passage.name === link))
		);

		/* We center the new passages underneath this one. */

		const newTop = passage.top + 100 * 1.5;

		/*
		We account for the total width of the new passages as both the width of
		the passages themselves plus the spacing in between.
		*/

		const totalWidth = newLinks.length * 100 +
			((newLinks.length - 1) * (100 / 2));
		let newLeft = passage.left + (100 - totalWidth) / 2;

		newLinks.forEach(link => {
			store.dispatch(
				'CREATE_PASSAGE_IN_STORY',
				storyId,
				{
					name: link,
					left: newLeft,
					top: newTop
				}
			);

			const newPassage = story.passages.find(p => p.name === link);

			if (newPassage) {
				actions.positionPassage(
					store,
					storyId,
					newPassage.id,
					gridSize
				);
			}
			else {
				console.warn('Could not locate newly-created passage in order to position it');
			}

			newLeft += 100 * 1.5;
		});
	},

	/* Updates links to a passage in a story to a new name. */

	changeLinksInStory(store, storyId, oldName, newName) {
		// TODO: add hook for story formats to be more sophisticated

		const story = store.state.story.stories.find(
			story => story.id === storyId
		);

		if (!story) {
			throw new Error(`No story exists with id ${storyId}`);
		}

		/*
		Escape regular expression characters.
		Taken from https://developer.mozilla.org/en/docs/Web/JavaScript/Guide/Regular_Expressions
		*/

		const oldNameEscaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const newNameEscaped = newName.replace(/\$/g, '$$$$');

		const simpleLinkRe = new RegExp(
			'\\[\\[' + oldNameEscaped + '(\\]\\[.*?)?\\]\\]',
			'g'
		);
		const compoundLinkRe = new RegExp(
			'\\[\\[(.*?)(\\||->)' + oldNameEscaped + '(\\]\\[.*?)?\\]\\]',
			'g'
		);
		const reverseLinkRe = new RegExp(
			'\\[\\[' + oldNameEscaped + '(<-.*?)(\\]\\[.*?)?\\]\\]',
			'g'
		);

		story.passages.forEach(passage => {
			if (simpleLinkRe.test(passage.text) ||
				compoundLinkRe.test(passage.text) ||
				reverseLinkRe.test(passage.text)) {
				let newText = passage.text;

				newText = newText.replace(
					simpleLinkRe,
					'[[' + newNameEscaped + '$1]]'
				);
				newText = newText.replace(
					compoundLinkRe,
					'[[$1$2' + newNameEscaped + '$3]]'
				);
				newText = newText.replace(
					reverseLinkRe,
					'[[' + newNameEscaped + '$1$2]]'
				);

				store.dispatch(
					'UPDATE_PASSAGE_IN_STORY',
					storyId,
					passage.id,
					{ text: newText }
				);
			}
		});
	},

	createFormat({ dispatch }, props) {
		dispatch('CREATE_FORMAT', props);
	},

	updateFormat({ dispatch }, id, props) {
		dispatch('UPDATE_FORMAT', id, props);
	},

	deleteFormat({ dispatch }, id) {
		dispatch('DELETE_FORMAT', id);
	},

	createFormatFromUrl(store, url) {
		return new Promise((resolve, reject) => {
			jsonp(
				url,
				{ name: 'storyFormat', timeout: 2000 },
				(err, data) => {
					if (err) {
						reject(err);
						return;
					}

					const pVer = semverUtils.parse(data.version);
					const pMinor = parseInt(pVer.minor);
					const pPatch = parseInt(pVer.patch);
	
					/*
					Check for an identical version.
					*/
	
					if (store.state.storyFormat.formats.some(current => {
						return current.version === data.version;
					})) {
						reject(new Error(
							locale.say('this story format is already installed')
						));
						return;
					}
	
					/*
					Check for a more recent version.
					*/
	
					if (store.state.storyFormat.formats.some(current => {
						const cVer = semverUtils.parse(current.version);
	
						return current.name === data.name &&
							cVer.major === pVer.major &&
							parseInt(cVer.minor) >= pMinor &&
							parseInt(cVer.patch) >= pPatch;
					})) {
						reject(new Error(
							locale.say(
								'a more recent version of the story format &ldquo;%s&rdquo; is already installed',
								data.name
							)
						));
						return;
					}
	
					const format = {
						name: data.name,
						version: data.version,
						url,
						userAdded: true,
						properties: data
					};
	
					store.dispatch('CREATE_FORMAT', format);
					resolve(format);
				}
			);
		});
	},

	loadFormat(store, name, version) {
		/*
		We pick the highest version that matches the major version of the
		string (e.g. if we ask for version 2.0.8, we may get 2.6.1).
		*/

		const majorVersion = semverUtils.parse(version).major;
		const formats = store.state.storyFormat.formats.filter(
			format => format.name === name &&
				semverUtils.parse(format.version).major === majorVersion
		);

		if (formats.length === 0) {
			throw new Error('No format is available named ' + name);
		}

		const format = formats.reduce((prev, current) => {
			const pVer = semverUtils.parse(prev.version);
			const pMinor = parseInt(pVer.minor);
			const pPatch = parseInt(pVer.patch);
			const cVer = semverUtils.parse(current.version);
			const cMinor = parseInt(cVer.minor);
			const cPatch = parseInt(cVer.patch);

			if (cMinor <= pMinor && cPatch <= pPatch) {
				return prev;
			}

			return current;
		});

		if (!format) {
			throw new Error('No format is available for version ' + version);
		}

		return new Promise((resolve, reject) => {
			if (format.loaded) {
				resolve(format);
				return;
			}

			jsonp(
				format.url,
				{ name: 'storyFormat', timeout: 2000 },
				(err, data) => {
					if (err) {
						reject(err);
						return;
					}

					store.dispatch('LOAD_FORMAT', format.id, data);
					resolve(format);
				}
			);
		});
	},

	/*
	Create built-in formats, repair paths to use kebab case (in previous
	versions we used camel case), and set version numbers.
	*/

	repairFormats(store) {
		/*
		Delete unversioned formats.
		*/

		store.state.storyFormat.formats.forEach(format => {
			if (typeof format.version !== 'string' || format.version === '') {
				console.warn(
					`Deleting unversioned story format ${format.name}`
				);
				actions.deleteFormat(store, format.id);
			}
		});

		/*
		Create built-in story formats if they don't already exist.
		*/

		const builtinFormats = [
			{
				name: 'Harlowe',
				url: 'story-formats/harlowe-1.2.4/format.js',
				version: '1.2.4',
				userAdded: false
			},
			{
				name: 'Harlowe',
				url: 'story-formats/harlowe-2.0.1/format.js',
				version: '2.0.1',
				userAdded: false
			},
			{
				name: 'Paperthin',
				url: 'story-formats/paperthin-1.0.0/format.js',
				version: '1.0.0',
				userAdded: false
			},
			{
				name: 'Snowman',
				url: 'story-formats/snowman-1.3.0/format.js',
				version: '1.3.0',
				userAdded: false
			},
			{
				name: 'SugarCube',
				url: 'story-formats/sugarcube-1.0.35/format.js',
				version: '1.0.35',
				userAdded: false
			},
			{
				name: 'SugarCube',
				url: 'story-formats/sugarcube-2.18.0/format.js',
				version: '2.18.0',
				userAdded: false
			}
		];

		builtinFormats.forEach(builtin => {
			if (!store.state.storyFormat.formats.find(
				format => format.name === builtin.name &&
					format.version === builtin.version
			)) {
				actions.createFormat(store, builtin);
			}
		});

		/*
		Set default formats if not already set, or if an unversioned preference
		exists.
		*/

		if (typeof store.state.pref.defaultFormat !== 'object') {
			actions.setPref(
				store,
				'defaultFormat',
				{ name: 'Harlowe', version: '2.0.1' }
			);
		}

		if (typeof store.state.pref.proofingFormat !== 'object') {
			actions.setPref(
				store,
				'proofingFormat',
				{ name: 'Paperthin', version: '1.0.0' }
			);
		}

		/*
		Delete any outdated formats.
		*/

		const latestVersions = latestFormatVersions(store);

		store.state.storyFormat.formats.forEach(format => {
			if (!format.version) {
				return;
			}

			const v = semverUtils.parse(format.version);

			if (v.version !== latestVersions[format.name][v.major].version) {
				console.warn(
					`Deleting outdated story format ${format.name} ` +
					v.version
				);
				actions.deleteFormat(store, format.id);
			}
		});

		/*
		Bring format preferences in line with the latest of its major version
		series.
		*/

		const defaultFormat = store.state.pref.defaultFormat ||
			{ name: null, version: null };
		const defaultFormatVersion = semverUtils.parse(defaultFormat.version);
		const latestDefault = latestVersions[defaultFormat.name];
		const proofingFormat = store.state.pref.proofingFormat ||
			{ name: null, version: null };
		const proofingFormatVersion = semverUtils.parse(proofingFormat.version);
		const latestProofing = latestVersions[proofingFormat.name];

		if (latestDefault && latestDefault[defaultFormatVersion.major]) {
			actions.setPref(
				store,
				'defaultFormat',
				{
					name: defaultFormat.name,
					version: latestDefault[defaultFormatVersion.major].version
				}
			);
		}

		if (latestProofing && latestProofing[proofingFormatVersion.major]) {
			actions.setPref(
				store,
				'proofingFormat',
				{
					name: proofingFormat.name,
					version: latestProofing[proofingFormatVersion.major].version
				}
			);
		}
	},

	/*
	Repairs stories by ensuring that they always have a story format and
	version set.
	*/

	repairStories(store) {
		const latestVersions = latestFormatVersions(store);

		store.state.story.stories.forEach(story => {
			/*
			Reset stories without any story format.
			*/

			if (!story.storyFormat) {
				actions.updateStory(
					store,
					story.id,
					{ storyFormat: store.state.pref.defaultFormat.name }
				);
			}

			/*
			Coerce old SugarCube formats, which had version numbers in their
			name, to the correct built-in ones.
			*/

			if (/^SugarCube 1/.test(story.storyFormat)) {
				actions.updateStory(
					store,
					story.id,
					{
						storyFormat: 'SugarCube',
						storyFormatVersion: latestVersions['SugarCube']['1'].version
					}
				);
			}
			else if (/^SugarCube 2/.test(story.storyFormat)) {
				actions.updateStory(
					store,
					story.id,
					{
						storyFormat: 'SugarCube',
						storyFormatVersion: latestVersions['SugarCube']['2'].version
					}
				);
			}

			if (story.storyFormatVersion) {
				/*
				Update the story's story format to the latest available version.
				*/

				const majorVersion = semverUtils.parse(
					story.storyFormatVersion
				).major;

				if (latestVersions[story.storyFormat][majorVersion]) {
					actions.updateStory(
						store,
						story.id,
						{
							/* eslint-disable max-len */
							storyFormatVersion: latestVersions[story.storyFormat][majorVersion].version
							/* eslint-enable max-len */
						}
					);
				}
			}
			else if (latestVersions[story.storyFormat]) {
				/*
				If a story has no format version, pick the lowest major version
				number currently available.
				*/

				const majorVersion = Object.keys(
					latestVersions[story.storyFormat]
				).reduce(
					(prev, current) => (current < prev) ? current : prev
				);

				actions.updateStory(
					store,
					story.id,
					{
						/* eslint-disable max-len */
						storyFormatVersion: latestVersions[story.storyFormat][majorVersion].version
						/* eslint-enable max-len */
					}
				);
			}
		});
	}
};
