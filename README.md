# adapt-contrib-spoor  

**Spoor** is an *extension* bundled with the [Adapt framework](https://github.com/adaptlearning/adapt_framework).  

This extension provides course tracking functionality (hence the name). Currently it only officially supports tracking to [SCORM](https://en.wikipedia.org/wiki/Sharable_Content_Object_Reference_Model) 1.2 [Learning Management Systems (LMS)](https://en.wikipedia.org/wiki/Learning_management_system), however, experienced users should be able to implement SCORM 2004 should this be needed as the underlying code is almost entirely version-agnostic (it's the packaging part you'll need to do yourself).

**Spoor** makes use of the excellent [pipwerks SCORM API Wrapper](https://github.com/pipwerks/scorm-api-wrapper/).

[Visit the **Spoor** wiki](https://github.com/adaptlearning/adapt-contrib-spoor/wiki) for more information about its functionality and for explanations of key properties.  

## Installation

As one of Adapt's *[core extensions](https://github.com/adaptlearning/adapt_framework/wiki/Core-Plug-ins-in-the-Adapt-Learning-Framework#extensions),* **Spoor** is included with the [installation of the Adapt framework](https://github.com/adaptlearning/adapt_framework/wiki/Manual-installation-of-the-Adapt-framework#installation) and the [installation of the Adapt authoring tool](https://github.com/adaptlearning/adapt_authoring/wiki/Installing-Adapt-Origin).

* If **Spoor** has been uninstalled from the Adapt framework, it may be reinstalled.
With the [Adapt CLI](https://github.com/adaptlearning/adapt-cli) installed, run the following from the command line:  
`adapt install adapt-contrib-spoor`

    Alternatively, this component can also be installed by adding the following line of code to the *adapt.json* file:  
    `"adapt-contrib-spoor": "*"`  
    Then running the command:  
    `adapt install`  
    (This second method will reinstall all plug-ins listed in *adapt.json*.)  

* If **Spoor** has been uninstalled from the Adapt authoring tool, it may be reinstalled using the [Plug-in Manager](https://github.com/adaptlearning/adapt_authoring/wiki/Plugin-Manager).  
<div float align=right><a href="#top">Back to Top</a></div>  

## Usage Instructions  
The following must be completed in no specific order:  
- [Add tracking IDs in *blocks.json*.](#add-tracking-ids)  
- [Configure *config.json*.](#configure-configjson)  

### Add tracking IDs  

Each block in *blocks.json* **must** include the following attribute:  
`"_trackingId": `  
Its value must be a unique number. There is no requirement that these values be sequential, but it is recommended as it can aid in debugging tracking issues if they are. Best practice begins the sequence of tracking IDs with `0`.  

An alternative to manually inserting the tracking IDs is to run the following grunt command. With your course root as the current working directory, run:  
`grunt tracking-insert`  
If later you add more blocks, run this again to assign tracking IDs to the new blocks. (`grunt tracking-insert` maintains a variable in *course.json* called `_latestTrackingId`. This variable is not used by **Spoor** itself, just by the grunt task.)  

<div float align=right><a href="#top">Back to Top</a></div>  

### Configure *config.json*  
**NOTE:**  as of Adapt/Spoor v3 you will first need to configure the settings in the **\_completionCriteria** object in config.json to specify whether you want course completion to be based on content completion, assessment completion, or both. (In earlier versions of Spoor these settings were part of the spoor configuration - but were moved to the core of Adapt so that they could be used by other tracking extensions such as xAPI.)

The attributes listed below are used in *config.json* to configure **Spoor**, and are properly formatted as JSON in [*example.json*](https://github.com/adaptlearning/adapt-contrib-spoor/blob/master/example.json). Visit the [**Spoor** wiki](https://github.com/adaptlearning/adapt-contrib-spoor/wiki) for more information about how they appear in the [authoring tool](https://github.com/adaptlearning/adapt_authoring/wiki).  


#### Attributes

**\_spoor**: (object): The Spoor object that contains values for **\_isEnabled**, **\_tracking**, **\_reporting**, and **\_advancedSettings**.
 
**\_isEnabled** (boolean): Enables/disables the **Spoor** extension. If set to `true` (the default value), the plugin will try to connect to a SCORM conformant LMS when the course is launched via *index_lms.html*. If one is not available, a 'Could not connect to LMS' error message will be displayed. This error can be avoided during course development either by setting this to `false` or - more easily - by launching the course via *index.html*. This latter technique is also useful if you are developing a course that could be run either from an LMS or a regular web server.

>**\_tracking** (object): This object defines what kinds of data to record to the LMS. Contains values for **\_shouldSubmitScore**, **\_shouldStoreResponses** and **\_shouldRecordInteractions**.  

>>**\_shouldSubmitScore** (boolean): Determines whether the assessment score will be reported to the LMS. Note that SCORM only supports one score per SCO, so if you have multiple assessments within your course, one aggregated score will be recorded. Acceptable values are `true` or `false`. The default is `false`.  

>>**\_shouldStoreResponses** (boolean): Determines whether the user's responses to questions should be persisted across sessions (by storing them in `cmi.suspend_data`) or not. Acceptable values are `true` or `false`. The default is `false`. Note that if you set this to `true`, the user will not be able to attempt questions within the course again unless some mechanism for resetting them is made available (for example, see `_isResetOnRevisit` in [adapt-contrib-assessment](https://github.com/adaptlearning/adapt-contrib-assessment)).

>>**\_shouldRecordInteractions** (boolean): Determines whether the user's responses to questions should be tracked to  the `cmi.interactions` fields of the SCORM data model or not. Acceptable values are `true` or `false`. The default is `true`. Note that not all SCORM 1.2 conformant Learning Management Systems support `cmi.interactions`. The code will attempt to detect whether support is implemented or not and, if not, will fail gracefully. Occasionally the code is unable to detect when `cmi.interactions` are not supported, in those (rare) instances you can switch off interaction tracking using this property so as to avoid 'not supported' errors. You can also switch off interaction tracking for any individual question using the `_recordInteraction` property of question components. All core question components support recording of interactions, community components will not necessarily do so.

>**\_reporting** (object): This object defines what status to report back to the LMS. Contains values for **\_onTrackingCriteriaMet**, **\_onAssessmentFailure** and **\_resetStatusOnLanguageChange**.  

>>**\_onTrackingCriteriaMet** (string): Specifies the status that is reported to the LMS when the tracking criteria (as defined in the **\_completionCriteria** object in config.json) are met. Acceptable values are: `"completed"`, `"passed"`, `"failed"`, and `"incomplete"`. If you are tracking a course by assessment, you would typically set this to `"passed"`. Otherwise, `"completed"` is the usual value.

>>**\_onAssessmentFailure** (string): Specifies the status that is reported to the LMS when the assessment is failed. Acceptable values are `"failed"` and `"incomplete"`. Some Learning Management Systems will prevent the user from making further attempts at the course after status has been set to `"failed"`. Therefore, it is common to set this to `"incomplete"` to allow the user more attempts to pass an assessment.  

>>**\_resetStatusOnLanguageChange** (boolean): If set to `true` the status of the course is set to "incomplete" when the languge is changed using the [adapt-contrib-languagePicker](https://github.com/adaptlearning/adapt-contrib-languagepicker) Plugin. Acceptable values are `true` or `false`. The default is `false`.       

>**\_advancedSettings** (object): The advanced settings attribute group contains values for **\_scormVersion**, **\_showDebugWindow**, **\_suppressErrors**, **\_commitOnStatusChange**, **\_timedCommitFrequency**, **\_maxCommitRetries**, **\_commitRetryDelay**, **\_commitOnVisibilityChangeHidden**, **\_exitStateIfIncomplete**, and **\_exitStateIfComplete**.

>>**\_scormVersion** (string): This property defines what version of SCORM is targeted. Only SCORM 1.2 is officially supported by Adapt. SCORM 2004 should work, but the Adapt team don't include this version in testing. To enable SCORM 2004 support, change this value to `"2004"` and include the relevant SCORM 2004 packaging files (*imsmanifest.xml* and others - you can find examples over at [scorm.com](http://scorm.com/scorm-explained/technical-scorm/content-packaging/xml-schema-definition-files/)). The default is `"1.2"`.  

>>**\_showDebugWindow** (boolean): If set to `true`, a pop-up window will be shown on course launch that gives detailed information about what SCORM calls are being made. This can be very useful for debugging SCORM issues. Note that this pop-up window will appear automatically if the SCORM code encounters an error, even if this is set to `false`. You can also hold down the keys 'd', 'e' and 'v' to force the popup window to open. The default is `false`. 

>>**\_suppressErrors** (boolean): If set to `true`, an alert dialog will NOT be shown when a SCORM error occurs. Errors will still be logged but the user will not be informed that a problem has occurred. Note that setting **\_showDebugWindow** to `true` will still cause the debug popup window to be shown on course launch, this setting merely suppresses the alert dialog that would normally be shown when a SCORM error occurs. *This setting should be used with extreme caution as, if enabled, users will not be told about any LMS connectivity issues or other SCORM tracking problems.*

>>**\_commitOnStatusChange** (boolean): Determines whether a "commit" call should be made automatically every time the SCORM *lesson_status* is changed. The default is `true`.  

>>**\_timedCommitFrequency** (number): Specifies the frequency - in minutes - at which a "commit" call will be made. Set this value to `0` to disable automatic commits. The default is `10`.  

>>**\_maxCommitRetries** (number): If a "commit" call fails, this setting specifies how many more times the "commit" call will be attempted before giving up and throwing an error. The default is `5`.  

>>**\_commitRetryDelay** (number): Specifies the interval in milliseconds between commit retries. The default is `2000`.

>>**\_commitOnVisibilityChangeHidden** (boolean): Determines whether or not a "commit" call should be made when the [visibilityState](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilityState) of the course page changes to `"hidden"`. This functionality helps to ensure that tracking data is saved whenever the user switches to another tab or minimises the browser window - and is only available in [browsers that support the Page Visibility API](http://caniuse.com/#search=page%20visibility). The default is `true`.

>>**\_manifestIdentifier** (string): Used to set the `identifier` attribute of the `<manifest>` node in imsmanifest.xml - should you want to set it to something other than the default value of `"adapt_manifest"`. Strictly speaking, this value is meant to be unique for each SCO on the LMS; in practice, few LMSes require or enforce this.

>>**\_exitStateIfIncomplete** (string): Determines the 'exit state' (`cmi.core.exit` in SCORM 1.2, `cmi.exit` in SCORM 2004) to set if the course hasn't been completed. The default behaviour will cause the exit state to be set to an empty string for SCORM 1.2 courses, or `"suspend"` for SCORM 2004 courses. The default behaviour should be left in place unless you are confident you know what you are doing!

>>**\_exitStateIfComplete** (string): Determines the 'exit state' (`cmi.core.exit` in SCORM 1.2, `cmi.exit` in SCORM 2004) to set when the course has been completed. The default behaviour will cause the exit state to be set to an empty string for SCORM 1.2 courses, or `"normal"` for SCORM 2004 courses. The default behaviour should be left in place unless you are confident you know what you are doing! Note: if you are using SCORM 2004, you can set this to `"suspend"` to prevent the LMS from clearing all progress tracking when a previously-completed course is re-launched by the learner.

<div float align=right><a href="#top">Back to Top</a></div>  

### Running a course without tracking while Spoor is installed  
- Use *index.html* instead of *index_lms.html*.  
*OR*  
- Set `"_isEnabled": false` in *config.json*.

### Client Local Storage / Fake LMS / Adapt LMS Behaviour Testing
When **Spoor** is installed, *scorm_test_harness.html* can be used instead of *index.html* to allow the browser to store LMS states inside a browser cookie. This allows developer to test LMS specified behaviour outside of an LMS environment. If you run the command `grunt server-scorm`, this will start a local server and run the course using *scorm_test_harness.html* for you. 

Note that due to the data storage limitations of browser cookies, there is less storage space available than an LMS would provide. In particular having `_shouldRecordInteractions` enabled can cause a lot of data to be written to the cookie, using up the available storage more quickly - it is advised that you disable this setting when testing via *scorm_test_harness.html*. As of v2.1.1, a browser alert will be displayed if the code detects that the cookie storage limit has been exceeded.

## Limitations
 
Currently (officially) only supports SCORM 1.2  

----------------------------
**Version number:**  3.3.2   <a href="https://community.adaptlearning.org/" target="_blank"><img src="https://github.com/adaptlearning/documentation/blob/master/04_wiki_assets/plug-ins/images/adapt-logo-mrgn-lft.jpg" alt="adapt learning logo" align="right"></a>  
**Framework versions:** 3.5.0+  
**Author / maintainer:** Adapt Core Team with [contributors](https://github.com/adaptlearning/adapt-contrib-spoor/graphs/contributors)  
**Accessibility support:** n/a  
**RTL support:** n/a  
**Cross-platform coverage:** Chrome, Chrome for Android, Firefox (ESR + latest version), Edge, IE11, Safari 12+13 for macOS/iOS/iPadOS, Opera  
