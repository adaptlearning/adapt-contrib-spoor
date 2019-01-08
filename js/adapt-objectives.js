define([
	'core/js/adapt'
], function(Adapt) {

	/*
		## Objective types

		Objectives can be completion-based or event-based. A completion based objective changes state as the given content models (components, blocks, articles, content objects) are completed. State changes for event-based objectives are handled externally; allowing the behaviour of the objective to be implemented arbitrarily. Specify a completion-based objective using the property `_content` and assigning to it an array of content model IDs. An event-based objective is specified by assigning the name of the event to the `_event` property.

		## Objective identifiers

		Objective IDs can be given directly in config.json. Alternatively, objective IDs can be given by paths. A path uses standard dot and array notation. The path is relative to the global Adapt object. An example use of paths could be localisation; where the localised identifiers are stored with the associated JSON (e.g. contentObjects.json).

		### Example objective ID paths

		Prefix with @@ to specify a path and use dot and array notation. All paths are relative to the global Adapt object. For example:

		@@course._objectives.objective1._id
		@@course._objectives[0]._id
		@@contentObjects._byAdaptID[co-05][0]._objectiveId

		## Objective states

		On first run of a course an objective can be optionally initialised with the state `not attempted`. Specify whether this should happen with the property `_initialiseWithNotAttempted`. How the objective state changes depends on the type of objective: for completion-based objectives the state will change as the content models are completed. The state of event-based objectives is controlled externally; typically this will be from a custom plugin. When an objective enters a new state it can be locked into this state to prevent future changes. Such states are described as immutable state. Specify these using the `_immutableStates` property. An example usage could be for completion-based objectives that once complete, should not be affected by content models being reset.

		NOTES:
			-Watching descendants of models and updating status to incomplete is an idea for future development.
			-Modifications to spoor files: wrapper.js, adapt-offlineStorage-scorm.js, adapt-stateful-session.js, offline_wrapper_API.js
			-Made storing interactions/objectives locally configurable (for testing purposes) (see https://github.com/adaptlearning/adapt_framework/issues/1905)
			-Future development might add support for making the pass/fail of an assessment an objective. If SCORM 2004 is used this could utilise the cmi.objectives.n.success_status field.
			- The changes will need to be applied to the master and legacy branches of spoor

		TODO:
	*/

	var defaultImmutableStates = ['completed'];

	var Objectives = _.extend({

		initialize:function() {
			// TODO: remove (testing purposes only!)
			Adapt.resolveObjectiveId = this.resolveObjectiveId;

			if (!Adapt.config.has('_spoor') || Adapt.config.get('_spoor')._isEnabled === false) return;
			if (!Adapt.config.get('_spoor')._objectives || Adapt.config.get('_spoor')._objectives._isEnabled === false) return;

			this._config = Adapt.config.get('_spoor')._objectives;
			this._listeners = [];

			this.setupItems(this._config._items);
		},

		setupItems:function(items) {
			if (_.isEmpty(items)) return;

			_.each(items, function(item) {
				item._id = this.resolveObjectiveId(item._id);

				if (!this.isObjectiveIDValid(item._id)) {
					console.error('Objective ID', item._id, 'is invalid. Please only use alphanumeric characters');
					return;
				}

				var status = Adapt.offlineStorage.get('objectiveCompletionStatus', item._id);
				var immutableStates = this.getImmutableStates(item);

				if (immutableStates.indexOf(status) != -1) {
					return;
				}

				if ((status == null || status == 'unknown') && item._initialiseWithNotAttempted) {
					Adapt.offlineStorage.set('objectiveCompletionStatus', item._id, 'not attempted');
				}

				if (!_.isEmpty(item._content)) {
					this.setupContentCompletionListener(item);
				} else if (!_.isEmpty(item._event)) {
					this.setupCustomEventListener(item);
				}
			}, this);
		},

		// status determined externally; register handler for global event (status passed as argument to handler)
		setupCustomEventListener:function(item) {
			var immutableStates = this.getImmutableStates(item);

			Adapt.on(item._event, check);

			function check(status) {
				var status = status || 'completed';

				Adapt.offlineStorage.set('objectiveCompletionStatus', item._id, status);

				if (immutableStates.indexOf(status) != -1) {
					Adapt.off(item._event, check);
				}
			}
		},

		// status determined by the completion state of one or more Adapt models
		setupContentCompletionListener:function(item) {
			var that = this;
			var contentModels = [];
			var immutableStates = this.getImmutableStates(item);
			var isComplete = function(model) {
				return model.get('_isComplete');
			};
			var removeListeners = function() {
				_.each(contentModels, function(model) {
					model.off('change:_isComplete', checkCompletion);
				});
			};
			var checkCompletion = function() {
				var completeCount = _.filter(contentModels, isComplete).length;
				if (completeCount == contentModels.length) {
					that.log('objective', item._id, 'completed');

					Adapt.offlineStorage.set('objectiveCompletionStatus', item._id, 'completed');

					if (immutableStates.indexOf('completed') != -1) {
						removeListeners();
					}
				} else if (completeCount > 0) {
					that.log('objective', item._id, 'incomplete');

					Adapt.offlineStorage.set('objectiveCompletionStatus', item._id, 'incomplete');
				}
			};

			_.each(item._content, function(contentId) {
				var model = Adapt.findById(contentId);
				contentModels.push(model);
				model.on('change:_isComplete', checkCompletion);
				console.log('listening to completion event on', model.get('_id'));
			});

			checkCompletion();
		},

		getImmutableStates:function(item) {
			var immutableStates = defaultImmutableStates;

			if (!_.isEmpty(item._immutableStates)) immutableStates = item._immutableStates;

			return immutableStates;
		},

		isObjectiveIDValid:function(id) {
			if (!_.isString(id) || id.length == 0) return;

			var match = id.match(/^[a-zA-Z0-9]*$/);
			return match && match[0].length == id.length;
		},

		resolveObjectiveId:function(id) {
			if (id[0] == '@' && id[1] == '@') {
				id = id.slice(2);
				var tokens = id.split('.');
				var ctx = null;

				_.each(tokens, function(name) {
					ctx = resolve(ctx == null ? Adapt : ctx, name);
				});

				return ctx;
			}

			function resolve(ctx, name) {
				var arrayPath = name.slice(-1) == ']' ? getIndices(name) : null;
				var value;

				if (arrayPath) name = arrayPath.name;

				if (ctx[name]) value = ctx[name];
				else if (ctx instanceof Backbone.Model) value = ctx.get(name);
				else {
					console.error('Invalid path for objective ID:', id);
					return;
				}

				if (arrayPath) {
					_.each(arrayPath.indices, function(index) {
						value = value[index];
					});
				}

				return value;
			}

			function getIndices(str) {
			    var index = 0;
			    var indices = [];

			    while (str[index + 1] != '[') {
			        index++;
			    }

			    var name = str.substr(0, index + 1);
			    
			    while (str[index + 1] == '[') {
			        index++;
			        var startIndex = index;
			        while (str[index + 1] != ']') {
			            index++;
			        }
			        indices.push(str.substr(startIndex + 1, index - startIndex));
			        index++;
			    }

			    return {name:name, indices:indices};
			}

			return id;
		},

		log:function() {
			if (Adapt.log && false) {
				Adapt.log.info.apply(Adapt.log, arguments);
			} else {
				console.log.apply(console, arguments);
			}
		}

	}, Backbone.Events);

	return Objectives;
});
