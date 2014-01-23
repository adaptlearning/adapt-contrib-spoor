adapt-contrib-spoor
===================

##Usage instructions
In order to get this to work in adapt_framework, for now, you will also need to manually enter integer _trackingId attributes into each block in blocks.json and a _latestTrackingId (which should be the highest value entered in blocks.json) into course.json (this will be automated with Grunt eventually).

Then, after grunt dev or grunt build has been run, copy all files from adapt-contrib-spoor/required into the root of the build folder. I haven't yet been able to test the completion criteria due to some components not completing, and there not yet being an assessment.