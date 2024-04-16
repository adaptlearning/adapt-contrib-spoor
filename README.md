# adapt-contrib-spoor

**Spoor** is an *extension* bundled with the [Adapt framework](https://github.com/adaptlearning/adapt_framework).

This extension provides course tracking functionality (hence the name [spoor](https://en.wikipedia.org/wiki/Spoor_(animal))) via [SCORM](https://en.wikipedia.org/wiki/Sharable_Content_Object_Reference_Model) standards for compliant [Learning Management Systems (LMS)](https://en.wikipedia.org/wiki/Learning_management_system). As default, only SCORM 1.2 or SCORM 2004 4th Edition files are included. See [_scormVersion](https://github.com/adaptlearning/adapt-contrib-spoor?tab=readme-ov-file#_scormversion-string) for details on how to configure this accordingly.

**Spoor** makes use of the excellent [pipwerks SCORM API Wrapper](https://github.com/pipwerks/scorm-api-wrapper/).

[Visit the **Spoor** wiki](https://github.com/adaptlearning/adapt-contrib-spoor/wiki) for more information about its functionality and for explanations of key properties.

## Installation

As one of Adapt's *[core extensions](https://github.com/adaptlearning/adapt_framework/wiki/Core-Plug-ins-in-the-Adapt-Learning-Framework#extensions),* **Spoor** is included with the [installation of the Adapt framework](https://github.com/adaptlearning/adapt_framework/wiki/Manual-installation-of-the-Adapt-framework#installation) and the [installation of the Adapt authoring tool](https://github.com/adaptlearning/adapt_authoring/wiki/Installing-the-Authoring-Tool).

If **Spoor** has been uninstalled from the Adapt framework, it may be reinstalled using one of the following methods:

* With the [Adapt CLI](https://github.com/adaptlearning/adapt-cli) installed, run the following from the command line:
`adapt install adapt-contrib-spoor`

* Alternatively, add the following line of code to the *adapt.json* file:
  `"adapt-contrib-spoor": "*"`
  Then run the command `adapt install`. This will reinstall all plug-ins listed in *adapt.json*.

If **Spoor** has been uninstalled from the Adapt authoring tool, it may be reinstalled using the Plug-in Manager.

<div float align=right><a href="#top">Back to Top</a></div>

## Usage Instructions

The following must be completed in no specific order:

* [Add tracking IDs in *blocks.json*](#add-tracking-ids)
* [Configure *config.json*](#configure-configjson)

### Add tracking IDs

Each block in *blocks.json* **must** include the following attribute:
`"_trackingId":`
Its value must be a unique number. There is no requirement that these values be sequential, but it is recommended as it can aid in debugging tracking issues if they are. Best practice begins the sequence of tracking IDs with `0`.

An alternative to manually inserting the tracking IDs is to run the following grunt command. With your course root as the current working directory, run:
`grunt tracking-insert`
If later you add more blocks, run this again to assign tracking IDs to the new blocks. (`grunt tracking-insert` maintains a variable in *course.json* called `_latestTrackingId`. This variable is not used by **Spoor** itself, just by the grunt task.)

<div float align=right><a href="#top">Back to Top</a></div>

### Configure *config.json*

**NOTE:** As of Adapt/Spoor v3, you will first need to configure the settings in the **\_completionCriteria** object in config.json to specify whether you want course completion to be based on content completion, assessment completion, or both. In earlier versions of Spoor, these settings were part of the spoor configuration - but were moved to the core of Adapt so that they could be used by other tracking extensions such as xAPI.

The attributes listed below are used in *config.json* to configure **Spoor**, and are properly formatted as JSON in [*example.json*](https://github.com/adaptlearning/adapt-contrib-spoor/blob/master/example.json). Visit the [**Spoor** wiki](https://github.com/adaptlearning/adapt-contrib-spoor/wiki) for more information about how they appear in the [authoring tool](https://github.com/adaptlearning/adapt_authoring/wiki).

## Attributes

### \_spoor (object)

The `_spoor` object contains the setting `_isEnabled` and the `_tracking`, `_reporting` and `_advancedSettings` objects.

#### \_isEnabled (boolean)

Enables/disables this extension. If set to `true` (the default value), the plugin will try to connect to a SCORM conformant LMS when the course is launched via *index_lms.html*. If one is not available, a 'Could not connect to LMS' error message will be displayed. This error can be avoided during course development either by setting this to `false` or - more easily - by launching the course via *index.html*. This latter technique is also useful if you are developing a course that could be run either from an LMS or a regular web server.

#### \_tracking (object)

This object defines what kinds of data to record to the LMS. It consists of the following settings:

##### \_shouldSubmitScore (boolean)

Determines whether the assessment score will be reported to the LMS. Note that SCORM only supports one score per SCO, so if you have multiple assessments within your course, one aggregated score will be recorded. Acceptable values are `true` or `false`. The default is `false`.

##### \_shouldStoreResponses (boolean)

Determines whether the user's responses to questions should be persisted across sessions (by storing them in `cmi.suspend_data`) or not. Acceptable values are `true` or `false`. The default is `true`. Note that if you set this to `true`, the user will not be able to attempt questions within the course again unless some mechanism for resetting them is made available (for example, see `_isResetOnRevisit` in [adapt-contrib-assessment](https://github.com/adaptlearning/adapt-contrib-assessment)).

##### \_shouldStoreAttempts (boolean)

Determines whether the history of the user's responses to questions should be persisted across sessions (by storing them in `cmi.suspend_data`) or not. Acceptable values are `true` or `false`. The default is `false`.

##### \_shouldRecordInteractions (boolean)

Determines whether the user's responses to questions should be tracked to  the `cmi.interactions` fields of the SCORM data model or not. Acceptable values are `true` or `false`. The default is `true`. Note that not all SCORM 1.2 conformant Learning Management Systems support `cmi.interactions`. The code will attempt to detect whether support is implemented or not and, if not, will fail gracefully. Occasionally the code is unable to detect when `cmi.interactions` are not supported, in those (rare) instances you can switch off interaction tracking using this property so as to avoid 'not supported' errors. You can also switch off interaction tracking for any individual question using the `_recordInteraction` property of question components. All core question components support recording of interactions, community components will not necessarily do so.

##### \_shouldRecordObjectives (boolean)

Determines whether the user's content objects and their statuses should be tracked to the `cmi.objectives` fields of the SCORM data model or not. Acceptable values are `true` or `false`. The default is `true`. Note that not all SCORM 1.2 conformant Learning Management Systems support `cmi.objectives`. The code will attempt to detect whether support is implemented or not and, if not, will fail gracefully. Occasionally the code is unable to detect when `cmi.objectives` are not supported, in those (rare) instances you can switch off objectives using this property so as to avoid 'not supported' errors.

##### \_shouldCompress (boolean)

Allow variable LZMA compress on component state data. The default is `false`.

#### \_reporting (object)

This object defines what status to report back to the LMS. It consists of the following settings:

##### \_onTrackingCriteriaMet (string)

Specifies the status that is reported to the LMS when the tracking criteria (as defined in the `_completionCriteria` object in config.json) are met. Acceptable values are: `"completed"`, `"passed"`, `"failed"`, and `"incomplete"`. If you are tracking a course by assessment, you would typically set this to `"passed"`. Otherwise, `"completed"` is the usual value.

##### \_onAssessmentFailure (string)

Specifies the status that is reported to the LMS when the assessment is failed. Acceptable values are `"failed"` and `"incomplete"`. Some Learning Management Systems will prevent the user from making further attempts at the course after status has been set to `"failed"`. Therefore, it is common to set this to `"incomplete"` to allow the user more attempts to pass an assessment.

##### \_resetStatusOnLanguageChange (boolean)

If set to `true` the status of the course is set to "incomplete" when the languge is changed using the [adapt-contrib-languagePicker](https://github.com/adaptlearning/adapt-contrib-languagepicker) plugin. Acceptable values are `true` or `false`. The default is `false`.

#### \_advancedSettings (object)

The advanced settings objects contains the following settings. Note that you only need to include advanced settings if you want to change any of the following settings from their default values - and you only need to include those settings you want to change.

##### \_scormVersion (string)

This property defines what version of SCORM is targeted. Only SCORM 1.2 and SCORM 2004 4th Edition files are included. To use a different SCORM 2004 Edition, replace the [*scorm/2004*](https://github.com/adaptlearning/adapt-contrib-spoor/blob/master/scorm/2004) files accordingly - examples can be found at [scorm.com](http://scorm.com/scorm-explained/technical-scorm/content-packaging/xml-schema-definition-files/). Acceptable values are `"1.2"` or `"2004"`. The default is `"1.2"`.

##### \_showDebugWindow (boolean)

If set to `true`, a pop-up window will be shown on course launch that gives detailed information about what SCORM calls are being made. This can be very useful for debugging SCORM issues. Note that this pop-up window will appear automatically if the SCORM code encounters an error, even if this is set to `false`. You can also hold down the keys <kbd>d</kbd>+<kbd>e</kbd>+<kbd>v</kbd> to force the popup window to open. The default is `false`.

##### \_suppressErrors (boolean)

If set to `true`, an alert dialog will NOT be shown when a SCORM error occurs. Errors will still be logged but the user will not be informed that a problem has occurred. Note that setting `_showDebugWindow` to `true` will still cause the debug popup window to be shown on course launch, this setting merely suppresses the alert dialog that would normally be shown when a SCORM error occurs. *This setting should be used with extreme caution as, if enabled, users will not be told about any LMS connectivity issues or other SCORM tracking problems.*

##### \_commitOnStatusChange (boolean)

Determines whether a "commit" call should be made automatically every time the SCORM *lesson_status* is changed. The default is `true`.

##### \_commitOnAnyChange (boolean)

Determines whether a "commit" call should be made automatically *every time* any SCORM value is changed. The default is `false`. Setting `_commitOnAnyChange` to `true` will disable 'timed commits'. **Note:** enabling this setting will make the course generate a lot more client-server traffic so you should only enable it if you are sure it is needed and, as it may have a detrimental impact on server performance, after careful load-testing. An alternative might be to first try setting a lower value for `_timedCommitFrequency`.

##### \_timedCommitFrequency (number)

Specifies the frequency - in minutes - at which a "commit" call will be made. Set this value to `0` to disable automatic commits. The default is `10`.

##### \_maxCommitRetries (number)

If a "commit" call fails, this setting specifies how many more times the "commit" call will be attempted before giving up and throwing an error. The default is `5`.

##### \_commitRetryDelay (number)

Specifies the interval in milliseconds between commit retries. The default is `2000`.

##### \_commitOnVisibilityChangeHidden (boolean)

Determines whether or not a "commit" call should be made when the [visibilityState](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilityState) of the course page changes to `"hidden"`. This functionality helps to ensure that tracking data is saved whenever the user switches to another tab or minimises the browser window - and is only available in [browsers that support the Page Visibility API](http://caniuse.com/?search=page%20visibility). The default is `true`.

##### \_manifestIdentifier (string)

Used to set the `identifier` attribute of the `<manifest>` node in imsmanifest.xml - should you want to set it to something other than the default value of `"adapt_manifest"`. Strictly speaking, this value is meant to be unique for each SCO on the LMS; in practice, few LMSes require or enforce this.

##### \_exitStateIfIncomplete (string)

Determines the 'exit state' (`cmi.core.exit` in SCORM 1.2, `cmi.exit` in SCORM 2004) to set if the course hasn't been completed. The default behaviour will cause the exit state to be set to an empty string for SCORM 1.2 courses, or `"suspend"` for SCORM 2004 courses. The default behaviour should be left in place unless you are confident you know what you are doing!

##### \_exitStateIfComplete (string)

Determines the 'exit state' (`cmi.core.exit` in SCORM 1.2, `cmi.exit` in SCORM 2004) to set when the course has been completed. The default behaviour will cause the exit state to be set to an empty string for SCORM 1.2 courses, or `"normal"` for SCORM 2004 courses. The default behaviour should be left in place unless you are confident you know what you are doing! Note: if you are using SCORM 2004, you can set this to `"suspend"` to prevent the LMS from clearing all progress tracking when a previously-completed course is re-launched by the learner.

##### \_setCompletedWhenFailed (boolean)

Determines whether the `cmi.completion_status` is set to "completed" if the assessment is "failed". Only valid for SCORM 2004, where the logic for completion and success is separate. The default is `true`.

##### \_connectionTest (object)

The settings used to configure the connection test when committing data to the LMS. The LMS API usually returns true for each data transmission regardless of the ability to persist the data. Contains the following attributes:

* **\_isEnabled** (boolean) Determines whether the connection should be tested. The default is `true`.

* **\_testOnSetValue** (boolean) Determines whether the connection should be tested for each call to set data on the LMS. The default is `true`.

  * **_silentRetryLimit** (number) The limit for silent retry attempts to establish a connection before raising an error. The default is `2`.

  * **_silentRetryDelay** (number) The interval in milliseconds between silent connection retries. The default is `1000`.

#### \_showCookieLmsResetButton (boolean)

Determines whether a reset button will be available to relaunch the course and optionally clear tracking data (scorm_test_harness.html only). The default is `false`.

#### \_shouldPersistCookieLMSData (boolean)

Determines whether to persist the cookie data over browser sessions (scorm_test_harness.html only). The default is `true`.

#### \_uniqueInteractionIds (boolean)

Determines whether `cmi.interactions.n.id` will be prepended with an index, making the id unique. Some LMSes require unique ids, this will inhibit the grouping of interactions by id on the server-side.

<div float align=right><a href="#top">Back to Top</a></div>

## Notes

### Running a course without tracking while Spoor is installed

Use *one* of the following methods:

1. Use *index.html* instead of *index_lms.html*.
2. Set `"_isEnabled": false` in *config.json*.

### Client Local Storage / Fake LMS / Adapt LMS Behaviour Testing

When **Spoor** is installed, *scorm_test_harness.html* can be used instead of *index.html* to allow the browser to store LMS states inside a browser cookie. This allows developers to test LMS-specific behaviour outside of an LMS environment. If you run the command `grunt server-scorm`, this will start a local server and run the course using *scorm_test_harness.html* for you.

Note that due to the data storage limitations of browser cookies, there is less storage space available than an LMS would provide. As of [v2.1.1](https://github.com/adaptlearning/adapt-contrib-spoor/releases/tag/v2.1.1), a browser alert will be displayed if the code detects that the cookie storage limit has been exceeded.

~~In particular having `_shouldRecordInteractions` enabled can cause a lot of data to be written to the cookie, using up the available storage more quickly - it is advised that you disable this setting when testing via *scorm_test_harness.html*.~~ As of [v3.0.0](https://github.com/adaptlearning/adapt-contrib-spoor/releases/tag/v3.0.0) this is no longer an issue - 'interaction data' is no longer saved to the cookie. As cmi.interactions are 'write only' in the SCORM spec, there was no reason to be doing this as the data would never be used.

As of [v3.7.0](https://github.com/adaptlearning/adapt-contrib-spoor/releases/tag/v3.7.0), you can make the cookie 'persistent' if you want to be able to have the cookie persist for longer than the browser's 'session'. For example, you might want to make basic tracking & bookmarking functionality available to learners when the course is being run from a regular web server (rather than an LMS or LRS). Just be aware that this isn't officially supported by the Adapt Core Team, so if you want to use this you do so at your own risk! Please see [the comments in scorm_test_harness.html](https://github.com/adaptlearning/adapt-contrib-spoor/blob/ecf5c16ca022345e69b08f02a523eb773f24ba07/required/scorm_test_harness.html#L24-L29) for details on how to make the cookie 'persistent'.

### SCORM Error Messages

As of [v3.6.0](https://github.com/adaptlearning/adapt-contrib-spoor/releases/tag/v3.6.0) it's possible to amend and/or translate the error messages that are shown by this extension whenever an LMS error is encountered. See [*example.json*](https://github.com/adaptlearning/adapt-contrib-spoor/blob/master/example.json) for the data that needs to be added to course/*lang*/course.json

Note that you only need to include those you want to amend/translate.

These error messages can also be amended via the Adapt Authoring Tool - but must be supplied in JSON format. For example, if you wanted to translate the 'could not connect to LMS' error into French, you would added the following into the 'Error messages' field under Project settings > Extensions > Spoor (SCORM):

```json
"title": "Une erreur s'est produite",
"CLIENT_COULD_NOT_CONNECT": "La connexion avec la plate-forme de formation n'a pas pu être établie."
```

### Print completion information from LMS data

If you have a course where learners are reporting completion problems, it can often be useful to check the stored suspend data to see if they are simply missing something out. As the relevant part of the suspend data is no longer in 'human-readable' format, Spoor v3.8.0 includes a `printCompletionInformation` function that translates this into into a more readable string of 1s and 0s which you can then match to the course's 'tracking ids' to see which bits of the course the learner hasn't completed.

To do this, run any course that uses Spoor v3.8.0 (or better) and execute the following via the browser console. Naturally, you need to replace the `suspendData` shown below with the one from the course you're trying to debug...

```js
var suspendData  = '{"lang":"en","a11y":false,"captions":"en","c":"hAA","q":"oAPQ4XADAcATDAHC4EYDgCYYA4XEDAcATDAHC4kYDgCYYA4XIDAcATDAHC5gbDgCYYbjhdAMBwBAMAcLqBgOAIBgDhdgMBwBAMAcLuBgOFwBABgDhdyMBwBAMAcLQgDAcLgCADAHC0JAwHC4AgAwBwtCSMBwBAMAcLQoDAcLgCADAHC0LAwHC4AgAwBwtDAMBwuAIAMAcLQwjAcAQDAHC0NAwHC4AgAwBwtDSMBwBAMAcLQ4DAcLgCADAHC0OIwHAEAwBwtDwMBwuAIAMAcLQ8jAcAQDAHC0QAwHC4AgAwBwtECMBwBAMAcLREDAcLgCADAHC0RIwHAEAwBwtEgMBwBAMAcLRMDAcAQDAA"}';
require('core/js/adapt').spoor.statefulSession.printCompletionInformation(suspendData);
```

That will output something like the following:

```console
INFO: course._isComplete: false, course._isAssessmentPassed: false, block completion: 11110000000000000000
```

Which, in the above example, indicates that the learner only completed the blocks with trackingIds 0, 1, 2, & 3.

## Limitations

Currently (officially) only supports SCORM 1.2

----------------------------
<a href="https://community.adaptlearning.org/" target="_blank"><img src="https://github.com/adaptlearning/documentation/blob/master/04_wiki_assets/plug-ins/images/adapt-logo-mrgn-lft.jpg" alt="adapt learning logo" align="right"></a>
**Author / maintainer:** Adapt Core Team with [contributors](https://github.com/adaptlearning/adapt-contrib-spoor/graphs/contributors)<br>
**Accessibility support:** n/a<br>
**RTL support:** n/a<br>
**Cross-platform coverage:** Chrome, Chrome for Android, Firefox (ESR + latest version), Edge, Safari 14 for macOS/iOS/iPadOS, Opera<br>
