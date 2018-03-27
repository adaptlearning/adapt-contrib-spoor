# adapt-elfh-spoor  
<a id="top" style="display:none"></a>

The **e-LfH Spoor** *extension* is for use with the the [Adapt framework](https://github.com/adaptlearning/adapt_framework).  It is based on the [adapt-contrib-spoor](https://github.com/adaptlearning/adapt-contrib-spoor) extension, which adds SCORM 1.2 tracking functionality to Adapt courses.  The e-LfH Spoor plugin adds **AICC HACP (HTTP-based AICC/CMI protocol)** tracking functionality, on top of existing SCORM tracking made available inside the adapt-contrib-spoor extension.

Please be aware that this extension has so far been tested and verified to work in the following LMS's.  If you encounter any issues with other LMS's please report them:

- e-Learning for Healthcare's Hub
- Moodle version 3.0 release candidate 4

AICC HACP allows organisations to run courses in their LMS applications, which are sitting on another organisation's domain, usually inside some sort of content repository, without causing [cross site scriping](https://en.wikipedia.org/wiki/Cross-site_scripting) errors in the user's web browser.  Running courses in this way is not possible using SCORM, because a web browser will throw a cross site scripting error and prevent the course from running for security reasons.  Please note that AICC HACP will only work if an application exists to relay the HTTP requests posts to and from the LMS.  This **relay** application often exists as part of an organisation's content repository.  This extension completes one part of the AICC HACP implementation but a relay application and an LMS capable of launching external AICC content, is required to make the entire process work.

**e-LfH Spoor** makes use of the [pipwerks SCORM API Wrapper](https://github.com/pipwerks/scorm-api-wrapper/).  Built on top of this wrapper, this extension has been designed so the additional AICC functionality is added unobstrusively.  Source code in the files aiccAPI.js and aiccLMS.js contain the additional tracking functionality and wrapper.js has been changed slightly to detect whether a request to run the course is made via HACP AICC or SCORM.  This means an Adapt course can be created which can switch between either AICC or SCORM using this single extension, without the need to create two versions of the same course, e.g. one version of the course containing the SCORM extension and another version containing an AICC extension.  Therefore removing the need to update two courses if the content is changed.

An Adapt course built to include this extension will run in one of three possible *modes*:

- if the course is launched outside of an LMS as a stand-alone website, the extension will not detect an AICC or SCORM LMS and the course will run without any tracking enabled.
- if the extension detects an AICC identifier and url in the querystring, then the course will run with AICC tracking enabled.
- if the extension detects a SCORM API in a parent frame, window or opener window, then the course will run with SCORM tracking enabled.

It's important to note that this extension doesn't attempt to implement the entire [AICC specification](https://github.com/ADL-AICC/AICC-Document-Archive/), but more specifically section *6.0 Communicating via HTTP (The HACP Binding)* in the document *CMI Guidelines for Interoperability AICC* ([cmi001v4.pdf](https://github.com/ADL-AICC/AICC-Document-Archive/releases/tag/cmi001v4)).  The extension adds the ability for an [LMS](https://en.wikipedia.org/wiki/Learning_management_system) that has HACP AICC functionality (such as [Moodle](https://moodle.org/), or [Kallidus](https://www.kallidus.com/)), to store values returned from a course stored on a domain other than the domain the LMS is running from.

For example, the course could be sitting on a domain that is acting as a content repository, e.g. *http://my-company/courses/course1*, and your client may want to run the course from their own Moodle LMS instance on their domain *http://the-client-LMS/*.  The administrator of the client's LMS would create a course in the LMS and configure it to point to the Adapt courses (containing the e-LfH Spoor extension) sitting on the other domain.

## Installation

This plugin should be used instead of the core Spoor plugin (adapt-contrib-spoor), when both SCORM and AICC tracking might be required.  To use this extension, uninstall adapt-contrib-spoor and install adapt-elfh-spoor.

Within the Adapt authoring tool you can uninstall adapt-contrib-spoor and install adapt-elfh-spoor using the [Plug-in Manager](https://github.com/adaptlearning/adapt_authoring/wiki/Plugin-Manager).

If you are creating your course using the Adapt framework directly and outside of the authoring tool, you can use uninstall and install the extensions using the [Adapt CLI](https://github.com/adaptlearning/adapt-cli).  Run the following from the command line:

1. `adapt uninstall adapt-contrib-spoor`
2. `adapt install adapt-elfh-spoor`

## Usage Instructions

Once installed, the extension will work automatically, provided it is configured properly.  You can should add an [IMS manifest file](https://github.com/adaptlearning/adapt-contrib-spoor#edit-the-manifest-file) if one is required, and any other appropriate details into [config.json](https://github.com/adaptlearning/adapt-contrib-spoor#configure-configjson) by following the instructions belonging to the adapt-contrib-spoor.

## Limitations
 
In AICC mode, only the following fields from the AICC specification, are available and are tracked:

* Core.StudentId
* Core.StudentName
* Core.LessonLocation
* Core.LessonStatus
* Core.Exit
* Core.Entry
* Core.Score
* Core.SessionTime
* Core.TotalTime
* SuspendData

<div float align=right><a href="#top">Back to Top</a></div>  

----------------------------
<a href="https://community.adaptlearning.org/" target="_blank"><img alt="@e-LfH" class="TableObject-item avatar" height="100" itemprop="image" src="https://avatars2.githubusercontent.com/u/30687181?v=4&amp;s=200" align="right"/></a> 
**Version number:**  0.1.1
**Framework versions:** 2.0.16
**Author / maintainer:** e-Learning For Healthcare with [contributors](https://github.com/e-LfH/adapt-elfh-spoor/graphs/contributors) 
**Accessibility support:** n/a
**RTL support:** n/a
**Cross-platform coverage:** Chrome, Chrome for Android, Firefox, Edge, IE 11, IE10, IE9, IE8, Safari iOS, Safari OS X
