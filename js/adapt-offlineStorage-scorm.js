import Adapt from 'core/js/adapt';
import ScormWrapper from './scorm/wrapper';
import SCORMSuspendData from './serializers/SCORMSuspendData';
import offlineStorage from 'core/js/offlineStorage';

/**
 * SCORM handler for offlineStorage interface.
 */
export default class OfflineStorageScorm extends Backbone.Controller {

  initialize(statefulSession) {
    this.offlineStorage = offlineStorage;
    this.scorm = ScormWrapper.getInstance();
    this.statefulSession = statefulSession;
    this.temporaryStore = {};
    this.suspendDataStore = {};
    this.suspendDataRestored = false;
    offlineStorage.initialize(this);
  }

  save() {
    this.statefulSession.saveSessionState();
    this.scorm.commit();
  }

  serialize(...args) {
    return SCORMSuspendData.serialize(...args);
  }

  deserialize(...args) {
    return SCORMSuspendData.deserialize(...args);
  }

  get(name) {
    if (name === undefined) {
      // If not connected return just temporary store.
      if (this.useTemporaryStore()) return this.temporaryStore;

      // Get all values as a combined object
      this.suspendDataStore = this.getCustomStates();

      const data = Object.assign(_.clone(this.suspendDataStore), {
        location: this.scorm.getLessonLocation(),
        score: this.scorm.getScore(),
        status: this.scorm.getStatus(),
        student: this.scorm.getStudentName(),
        learnerInfo: this.getLearnerInfo()
      });

      this.suspendDataRestored = true;

      return data;
    }

    // If not connected return just temporary store value.
    if (this.useTemporaryStore()) return this.temporaryStore[name];

    // Get by name
    let courseState;
    switch (name.toLowerCase()) {
      case 'location':
        return this.scorm.getLessonLocation();
      case 'score':
        return this.scorm.getScore();
      case 'status':
        return this.scorm.getStatus();
      case 'student':
        // for backwards-compatibility. learnerInfo is preferred now and will
        // give you more information
        return this.scorm.getStudentName();
      case 'learnerinfo':
        return this.getLearnerInfo();
      case 'coursestate': {
        courseState = this.getCustomState('c');
        const stateArray = (courseState && SCORMSuspendData.deserialize(courseState)) || [];
        return {
          _isCourseComplete: Boolean(stateArray.slice(0, 1).map(Number)[0]),
          _isAssessmentPassed: Boolean(stateArray.slice(1, 2).map(Number)[0]),
          completion: stateArray.slice(2).map(Number).map(String).join('') || ''
        };
      }
      case 'completion':
        courseState = this.getCustomState('c');
        return (courseState && SCORMSuspendData
          .deserialize(courseState)
          .slice(2)
          .map(Number)
          .map(String)
          .join('')) || '';
      case '_iscoursecomplete':
        courseState = this.getCustomState('c');
        return Boolean(courseState && SCORMSuspendData
          .deserialize(courseState)
          .slice(0, 1)
          .map(Number)[0]);
      case '_isassessmentpassed':
        courseState = this.getCustomState('c');
        return Boolean(courseState && SCORMSuspendData
          .deserialize(courseState)
          .slice(1, 2)
          .map(Number)[0]);
      case 'questions': {
        const questionsState = this.getCustomState('q');
        return questionsState || '';
      }
      default:
        return this.getCustomState(name);
    }
  }

  set(name, value) {
    // Convert arguments to array and drop the 'name' parameter
    const args = [...arguments].slice(1);
    const isObject = typeof name === 'object';

    if (isObject) {
      value = name;
      name = 'suspendData';
    }

    if (this.useTemporaryStore()) {
      if (isObject) {
        Object.assign(this.temporaryStore, value);
      } else {
        this.temporaryStore[name] = value;
      }

      return true;
    }

    switch (name.toLowerCase()) {
      case 'interaction':
        if (!this.statefulSession.shouldRecordInteractions) return;
        return this.scorm.recordInteraction(...args);
      case 'objectivedescription':
        if (!this.statefulSession.shouldRecordObjectives) return;
        return this.scorm.recordObjectiveDescription(...args);
      case 'objectivestatus':
        if (!this.statefulSession.shouldRecordObjectives) return;
        return this.scorm.recordObjectiveStatus(...args);
      case 'objectivescore':
        if (!this.statefulSession.shouldRecordObjectives) return;
        return this.scorm.recordObjectiveScore(...args);
      case 'location':
        return this.scorm.setLessonLocation(...args);
      case 'score':
        return this.scorm.setScore(...args);
      case 'status':
        return this.scorm.setStatus(...args);
      case 'student':
      case 'learnerinfo':
        return false;// these properties are read-only
      case 'lang':
        this.scorm.setLanguage(value);
        // fall-through so that lang gets stored in suspend_data as well:
        // because in SCORM 1.2 cmi.student_preference.language is an optional
        // data element so we can't rely on the LMS having support for it.
        // If it does support it we may as well save the user's choice there
        // purely for reporting purposes
        break;
      case 'suspenddata':
        break;
    }

    if (isObject) {
      Object.assign(this.suspendDataStore, value);
    } else {
      this.suspendDataStore[name] = value;
    }

    const dataAsString = JSON.stringify(this.suspendDataStore);
    return (this.suspendDataRestored) ? this.scorm.setSuspendData(dataAsString) : false;
  }

  clear() {
    this.temporaryStore = {};
    this.suspendDataStore = {};
    const dataAsString = JSON.stringify(this.suspendDataStore);
    this.scorm.setSuspendData(dataAsString);
  }

  getCustomStates() {
    const isSuspendDataStoreEmpty = _.isEmpty(this.suspendDataStore);
    if (!isSuspendDataStoreEmpty && this.suspendDataRestored) {
      return _.clone(this.suspendDataStore);
    }

    const dataAsString = this.scorm.getSuspendData();
    if (dataAsString === '' || dataAsString === ' ' || dataAsString === undefined) {
      return {};
    }

    const dataAsJSON = JSON.parse(dataAsString);
    if (!isSuspendDataStoreEmpty && !this.suspendDataRestored) {
      Object.assign(dataAsJSON, this.suspendDataStore);
    }
    return dataAsJSON;
  }

  getCustomState(name) {
    const dataAsJSON = this.getCustomStates();
    return dataAsJSON[name];
  }

  useTemporaryStore() {
    const cfg = Adapt.config.get('_spoor');

    if (!this.scorm.lmsConnected || (cfg?._isEnabled === false)) return true;
    return false;
  }

  /**
   * Returns an object with the properties:
   * - id (cmi.core.student_id)
   * - name (cmi.core.student_name - which is usually in the format
   *    'Lastname, Firstname' or 'Firstname Lastname' - but it sometimes doesn't
   *    have the space after the comma
   *   )
   * - firstname
   * - lastname
   */
  getLearnerInfo() {
    const id = this.scorm.getStudentId();

    let name = this.scorm.getStudentName();
    let firstname = '';
    let lastname = '';

    let hasName = (name && name !== 'undefined');
    const isNameCommaSeparated = hasName && name.includes(',');
    const isNameSpaceSeparated = hasName && name.includes(' ');

    // Name must have either a comma or a space
    hasName = hasName && (isNameCommaSeparated || isNameSpaceSeparated);

    if (!hasName) {
      console.log('SPOOR: LMS learner_name not in \'lastname, firstname\' or \'firstname lastname\' format');
      return { id, name, firstname, lastname };
    }

    const separator = isNameCommaSeparated ? ',' : ' ';
    const nameParts = name.split(separator);
    if (isNameCommaSeparated) {
      // Assume lastname appears before the comma
      nameParts.reverse();
    }
    [ firstname, lastname ] = nameParts.map(part => part.trim());
    name = `${firstname} ${lastname}`;
    return { id, name, firstname, lastname };
  }

}
