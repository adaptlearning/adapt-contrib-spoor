define([
  'underscore',
  'libraries/lzma-min',
  'libraries/lzma_worker-min.js'
], function(_) {
  const LZMAWorker = window.LZMAFactory('./libraries/lzma_worker-min.js');
  /**
   * 2020/05/06 SCORMSuspendData
   *
   * Serialize and deserialize arrays, booleans and numbers into a base64 string
   * for transport over SCORM 1.2 based systems where storage space is restricted
   * to only 4096 characters or 4KB.
   *
   * The algorithm is weighted heavily in efficiency towards storing data by
   * its occurrence frequency when it is used to save Adapt question responses,
   * booleans, arrays of <16 length and numbers of <4 value.
   *
   * Numbers can be 2 precision decimals, positive and negative numbers between
   * -4294967295.99 and 4294967295.99. Arrays can have 0 to 65535 entries. Arrays
   * can be nested. All arrays must have the same ES type (boolean, number or array).
   *
   * The appropriate binary type is chosen for each array according to the following table,
   * an array must have one type which best fits its values:
   *
   *           VALUES                                VALUETYPE     PER ENTRY
   * VALUETYPE MIN           MAX            DECIMAL  BITS          MIN BITS  MAX BITS  STORES
   * ARRAY     0             65535 (items)  NO       2             6         23        Array length and valuetype
   * BOOLEAN   0             1              NO       1             1         1         Entry value
   * UINT3     0             7              NO       4             3         3         Entry value
   * VINT8+    0             255            NO       3             3         9         Entry value
   * VINT8-   -255           0              NO       6             3         9         Entry value
   * SDEC15   -255.99        255.99         NO       6             8         22        Entry value
   * SINT32   -4294967295    4294967295     NO       6             5         35        Entry value
   * SDEC39   -4294967295.99 4294967295.99  YES      6             10        48        Entry value
   *
   * Output construction map:
   *
   *  OUTPUT = VALUETYPE + DATA
   *  DATA = ( ARRAY | BOOLEAN | UINT3 | VINT8+ | VINT8- | SDEC15 | SINT32 | SDEC39 )
   *  ARRAY = IS_SMALL_BIT( BOOLEAN ) + LENGTH( UINT4 | UINT16 ) + VALUETYPE + DATA[0-65535]
   *
   *  VALUETYPE = 0 to 111111
   *   Signifies the type of value for the output or array data.
   *
   *   BINARY  NAME        USAGE RANKING
   *   10      ARRAY       2
   *   0       BOOLEAN     1
   *   1110    UINT3       4
   *   110     VINT8+      3
   *   111100  VINT8-      7
   *   111101  SDEC15      5
   *   111110  SINT32      6
   *   111111  SDEC39      8
   *
   *  ARRAY
   *   Stores the number and type of items.
   *
   *          BINARY
   *   BITS | SMALL LENGTH (UINT4/16) VALUETYPE = VALUE
   *   6    | 1     0000              0         = zero length boolean array
   *   6    | 1     1111              0         = 15 length boolean array
   *   23   | 0     1000000000000000  111111    = 8 length sdec39 array
   *   23   | 0     1111111111111111  111111    = 65535 length sdec39 array
   *
   *  BOOLEAN
   *   A value of true or false.
   *
   *          BINARY
   *   BITS | BOOL  = VALUE
   *   1    | 0     = false
   *   1    | 1     = true
   *
   *  UINT3
   *   A value from 0 to 7 with a 3 bit fixed length output.
   *
   *          BINARY
   *   BITS | INT (UINT3) = VALUE
   *   3    | 000         = 0
   *   3    | 111         = 7
   *
   *  UINT4
   *   An array length from 0 to 15 with a 4 bit fixed length output.
   *
   *          BINARY
   *   BITS | INT (UINT4) = VALUE
   *   4    | 0000        = 0
   *   4    | 1111        = 15
   *
   *  VINT8+
   *   A value from 0 to 255 with variable length output.
   *   Output is a UINT2/8 bit integer with a 1 bit header.
   *
   *          BINARY
   *   BITS | SMALL INT (UINT2/8) = VALUE
   *   3    | 1     00           =  0
   *   3    | 1     11           =  3
   *   9    | 0     00000100     =  4
   *   9    | 0     11111111     =  255
   *
   *  VINT8-
   *   A value from -255 to 0 with variable length output.
   *   Output is a UINT2/8 bit integer with a 1 bit header.
   *
   *   BITS | SMALL INT (UINT2/8) = VALUE
   *   3    | 1     00            =  0
   *   3    | 1     11            = -3
   *   9    | 0     00000100      = -4
   *   9    | 0     11111111      = -255
   *
   *  SDEC15
   *   A value from -255.99 to 255.99 preserving 2 decimals places
   *   places and with variable length output.
   *
   *   BITS | SIGN INTSIZE INT (UINT2/8) DECSIZE DEC (UINT0/7)   = VALUE
   *   5    | 0    0       00            0                       =  0
   *   12   | 0    0       00            0       0000001         =  0.01
   *   12   | 1    0       00            0       0000001         = -0.01
   *   12   | 1    0       00            1       1100011         = -0.99
   *   18   | 0    1       00001000      1       0000001         =  8.01
   *   18   | 1    1       00001000      1       1100011         = -8.99
   *   18   | 0    1       11111111      1       1100011         =  255.99
   *   18   | 1    1       11111111      1       1100011         = -255.99
   *
   *  UINT16
   *   An array length from 0 to 65535 with a 16 bit fixed length output.
   *
   *          BINARY
   *   BITS | INT (UINT16)       = VALUE
   *   16   | 0000000000000000  = 0
   *   16   | 1111111111111111  = 65535
   *
   *  SINT32
   *   A value from -4294967295 to 4294967295 with variable length output.
   *   Output is a UINT2/4/16/32 bit integer with a 3 bit header.
   *
   *   BITS | SIGN SIZE  INT (UINT2/4/16/32)              = VALUE
   *   5    | 0    00    00                               =  0
   *   5    | 1    00    11                               = -3
   *   7    | 0    01    1000                             =  8
   *   7    | 1    01    1111                             = -15
   *   19   | 0    10    0000000100000000                 =  256
   *   19   | 1    10    1111111111111111                 = -65535
   *   35   | 1    11    11111111111111111111111111111111 = -4294967295
   *   35   | 0    11    11111111111111111111111111111111 =  4294967295
   *
   *  SDEC39
   *   A value from -4294967295.99 to 4294967295.99 preserving 2 decimals places
   *   places and with variable length output.
   *
   *   BITS | SIGN INTSIZE INT (UINT2/4/16/32)              DECSIZE DEC (UINT0/7)   = VALUE
   *   6    | 0    00      00                               0                       =  0
   *   13   | 0    00      11                               0       0000001         =  3.01
   *   13   | 1    01      1000                             0       0000001         = -8.01
   *   13   | 1    01      1111                             1       1100011         = -15.99
   *   27   | 0    10      0000000100000000                 1       0000001         =  256.01
   *   27   | 1    10      1111111111111111                 1       1100011         = -65535.99
   *   37   | 0    11      11111111111111111111111111111111 0                       =  4294967295
   *   37   | 1    11      11111111111111111111111111111111 0                       = -4294967295
   *   43   | 0    11      11111111111111111111111111111111 1       1100011         =  4294967295.99
   *   43   | 1    11      11111111111111111111111111111111 1       1100011         = -4294967295.99
   *
   * Output byte count formula:
   *
   *  byte_count = (bit_count * 1.5base64_expansion) / 8bits_per_byte
   *
   *  The output is in base64 so bit counts are always inflated by 1.5 from byte to base64.
   *
   * Example:
   *
   * [
   *   [
   *     0,
   *     7,
   *     1,
   *     0
   *   ],
   *   [
   *     true,
   *     true,
   *     true,
   *     true,
   *     true
   *   ],
   *   [
   *     true,
   *     false,
   *     false,
   *     false
   *   ]
   * ]
   *
   * In this example the parent array represents a completed question state for a
   * single question. The first child number-array stores the block location,
   * tracking id, score and attemptsLeft. The second child boolean-array stores
   * the completion, correctness, submission state and user answer states. The
   * third child boolean-array stores the user selections for a multiple choice question.
   *
   * When serialized with SCORMSuspendData.serialize() it becomes the following
   * 10 characters:
   *
   *   hxOHIK-RAA
   *
   * These characters can be deserialized back into the nested arrays above using
   * SCORMSuspendData.deserialize("hxOHIK-RAA");
   *
   * In JSON this array would usually be 63 characters minified, at 10 characters this is
   * a reduction of about 84%. At the worse case, storing an array containing just
   * the largest possible number ([-4294967295.99]) the output will only be reduced
   * by about 37% (g///////4w) when compared to the equivalent JSON. It is possible
   * to store 500 of the above mcq state arrays in just 4088 characters. About 250
   * question states will occupy about half of the available space in SCORM's 4096
   * character suspend data.
   */

  // Cache for zero strings of various lengths
  const ZeroString = {};
  /**
   * Make and cache a zero string up to the supplied length
   * @param {number} length
   * @returns {string}
   */
  function makeZeroString(length) {
    ZeroString[length] = ZeroString[length] || (new Array(length + 1)).join('0');
    return ZeroString[length];
  }
  // Initialize zero string cache up to 64 characters in length
  for (let i = 1, l = 64; i <= l; i++) {
    makeZeroString(i);
  }

  /**
   * Zero pads to the right, making up to the supplied length
   * @param {string} string
   * @param {number} length
   * @returns {string}
   */
  function zeroPadRightToLength(string, length) {
    const padLength = (length - string.length);
    if (padLength > 0) {
      string += makeZeroString(padLength);
    }
    return string;
  }

  /**
   * Zero pads to the left, making up to the supplied length
   * @param {string} string
   * @param {number} length
   * @returns {string}
   */
  function zeroPadLeftToLength(string, length) {
    const padLength = (length - string.length);
    if (padLength > 0) {
      string = makeZeroString(padLength) + string;
    }
    return string;
  }

  /**
   * Zero pads to the right at even multiples
   * @param {string} string
   * @param {number} multiple
   * @returns {string}
   */
  function zeroPadRightToMultiple(string, multiple) {
    const padLength = multiple - (string.length % multiple);
    if (padLength !== multiple) {
      string += makeZeroString(padLength);
    }
    return string;
  }

  /**
   * Returns a positive integer from the supplied binary string and binaryLength
   * @param {string} binary
   * @param {number} binaryLength
   * @returns {number}
   */
  function binaryToUnsignedInteger(binary, binaryLength) {
    if (binaryLength === 0) {
      return 0;
    }
    binary = zeroPadLeftToLength(binary, binaryLength);
    const integer = parseInt(binary.slice(0, binaryLength), 2);
    return integer;
  }

  /**
   * Shifts a positive integer from the supplied binary string and binaryLength,
   * returning the shifted integer and the next part of the binary string
   * @param {string} binary
   * @param {number} binaryLength
   * @returns {[number, string]}
   */
  function shiftUnsignedIntegerFromBinary(binary, binaryLength) {
    if (binaryLength === 0) {
      return [0, binary];
    }
    binary = zeroPadLeftToLength(binary, binaryLength);
    const integer = parseInt(binary.slice(0, binaryLength), 2);
    binary = binary.slice(binaryLength);
    return [integer, binary];
  }

  /**
   * Shifts binaryLength characters from the supplied binary string, returning the
   * shifted binary string and the next part of the binary string
   * @param {string} binary
   * @param {number} binaryLength
   * @returns {[string, string]}
   */
  function shiftBinary(binary, binaryLength) {
    if (binaryLength === 0) {
      return ['', binary];
    }
    binary = zeroPadLeftToLength(binary, binaryLength);
    const shifted = binary.slice(0, binaryLength);
    binary = binary.slice(binaryLength);
    return [shifted, binary];
  }

  /**
   * Converts a positive integer to a binary string
   * @param {number} integer
   * @param {number} [binaryLength] Length of the output string
   */
  function unsignedIntegerToBinary(integer, binaryLength) {
    if (binaryLength === 0) {
      return '';
    }
    let binary = Math.abs(integer).toString(2);
    if (typeof binaryLength === 'undefined') {
      return binary;
    }
    const length = binary.length;
    if (length > binaryLength) {
      throw new Error(`Integer too big for specified binary length. integer: ${integer} binarylen: ${binaryLength}`);
    }
    binary = zeroPadLeftToLength(binary, binaryLength);
    return binary;
  }

  /**
   * Converts a byte array to a string
   * @param {[number]} array
   * @returns {string}
   */
  function byteArrayToString(array) {
    const arrayLength = array.length;
    let string = new Array(arrayLength);
    for (let i = 0, l = arrayLength; i < l; i++) {
      string[i] = String.fromCharCode(array[i]);
    }
    string = string.join('');
    return string;
  }

  /**
   * Converts a string to a byte array
   * @param {string} string
   * @returns {[number]}
   */
  function stringToByteArray(string) {
    const stringLength = string.length;
    const array = new Array(stringLength);
    for (let i = 0, l = stringLength; i < l; i++) {
      array[i] = string.charCodeAt(i);
    }
    return array;
  }

  /** @type {number} Number of bits per byte */
  const BYTE_BIT_LENGTH = 8;

  /**
   * Converts a binary string or nested arrays of binary strings to a base64 string
   * @param {string|[string]} binary
   * @returns {string}
   */
  function binaryToBase64(binary) {
    binary = _.flatten(binary).join('');
    binary = zeroPadRightToMultiple(binary, BYTE_BIT_LENGTH);
    const bytesCount = binary.length / BYTE_BIT_LENGTH;
    const charCodes = new Array(bytesCount);
    for (let i = 0, l = bytesCount; i < l; i++) {
      [ charCodes[i], binary ] = shiftUnsignedIntegerFromBinary(binary, BYTE_BIT_LENGTH);
    }
    let base64 = btoa(byteArrayToString(charCodes));
    // Remove padding = or == as not necessary here
    base64 = base64.replace(/=/g, '');
    // Can't handle base64 with the + sign so swap with a -
    base64 = base64.replace(/\+/g, '-');
    return base64;
  }

  /**
   * Converts a base64 string to a binary string
   * @param {string} base64
   * @returns {string}
   */
  function base64ToBinary(base64) {
    // base64 should have a + instead of a -
    base64 = base64.replace(/-/g, '+');
    const charCodes = stringToByteArray(atob(base64));
    const bytesCount = charCodes.length;
    let binary = new Array(bytesCount);
    for (let i = 0, l = bytesCount; i < l; i++) {
      binary[i] = unsignedIntegerToBinary(charCodes[i], BYTE_BIT_LENGTH);
    }
    binary = binary.join('');
    return binary;
  }

  // Console output store
  const logs = {
    usedTypes: {},
    typeLengths: {},
    binarySamples: {}
  };

  /**
   * An abstract base class for a ValueType value to and from binary string converter
   */
  class AbstractValueType {

    /**
     * @param {Object} options
     * @param {string} options.name Name identifying the type
     * @param {string} options.binaryType Binary string identifying the type
     */
    constructor(options) {
      Object.assign(this, options);
      this.binaryTypeLength = this.binaryType.length;
    }

    /**
     * Adds a record of the binary string production to the logging store
     * @param {[Array|string]} binary
     */
    log(binary) {
      const name = this.name;
      logs.usedTypes[name] = logs.usedTypes[name] || 0;
      logs.usedTypes[name]++;
      logs.binarySamples[name] = logs.binarySamples[name] || [];
      logs.binarySamples[name].push(binary);
    }

  };

  /**
   * Converts a fixed length positive integer to and from a binary string.
   */
  class FixedIntegerType extends AbstractValueType {

    /**
     * @param {Object} options
     * @param {string} options.name Name identifying the type
     * @param {string} options.binaryType Binary string identifying the type
     * @param {number} options.valueBinaryLength Bit length of the integer
     */
    constructor(options) {
      super(options);
      this.esType = 'number';
      if (!this.valueBinaryLength) {
        return;
      }
      this.minValue = options.minValue || 0;
      this.maxValue = options.maxValue || Math.pow(2, this.valueBinaryLength) - 1;
    }

    /**
     * Converts a fixed length positive integer to an array of binary strings
     * @param {number} integer
     * @param {boolean} [logStats] Log the type usage for output to the console
     * @returns {[string]}
     */
    valueToBinary(integer, logStats = null) {
      let binary = unsignedIntegerToBinary(integer, this.valueBinaryLength);
      if (logStats) {
        this.log(binary);
      }
      binary = [binary];
      return binary;
    }

    /**
     * Shifts a fixed length positive integer from the binary string, returning
     * the integer and the next part of the binary string.
     * @param {string} binary
     * @returns {[number, string]}
     */
    shiftValueFromBinary(binary) {
      let integer;
      [integer, binary] = shiftUnsignedIntegerFromBinary(binary, this.valueBinaryLength);
      return [integer, binary];
    }

  }

  /**
   * Converts a boolean to and from a binary string
   */
  class FixedBooleanType extends FixedIntegerType {

    /**
     * @param {Object} options
     * @param {string} options.name Name identifying the type
     * @param {string} options.binaryType Binary string identifying the type
     */
    constructor(options) {
      options.valueBinaryLength = 1;
      super(options);
      this.esType = 'boolean';
    }

    /**
     * Shifts a boolean from the binary string, returning
     * the boolean and the next part of the binary string
     * @param {string} binary
     * @returns {[boolean, string]}
     */
    shiftValueFromBinary(binary) {
      const bool = (binary[0] === '1');
      binary = binary.slice(1);
      return [bool, binary];
    }

  }

  /**
   * A helper for converting variable length positive integers to and from a binary string
   */
  class LengthAndValueBinary {

    /**
     * @param {string} parent The parent AbstractValueType
     * @param {string} name The sub parent value part name "integer" or "decimal"
     * @param {[number]} bitSizes An ordered array of expressible bit lengths
     */
    constructor(parent, name, bitSizes) {
      this.parent = parent;
      this.name = name;
      this.bitSizes = bitSizes;
      this.maxValues = _.flatten(this.bitSizes).map(value => (Math.pow(2, value) - 1));
      this.maxValue = this.maxValues[this.maxValues.length - 1];
      this.sizeBinaryLength = unsignedIntegerToBinary(this.bitSizes.length - 1).length;
    }

    /**
     * Converts a positive integer to a binary string array
     * @param {number} integer
     * @param {boolean} [logStats] Log the type usage for output to the console
     * @returns {[string]}
     */
    valueToBinary(integer, logStats = null) {
      const parentName = this.parent.name;
      const sizeIndex = this.maxValues.findIndex(maxValue => (integer <= maxValue));
      if (sizeIndex === -1) {
        throw new Error(`Value is too large for type: ${parentName} value: ${integer} max: ${this.maxValue}`);
      }
      const sizeBinary = unsignedIntegerToBinary(sizeIndex, this.sizeBinaryLength);
      const valueLength = this.bitSizes[sizeIndex];
      const name = this.name;
      if (logStats) {
        logs.typeLengths[parentName] = logs.typeLengths[parentName] || {};
        logs.typeLengths[parentName][name] = logs.typeLengths[parentName][name] || {};
        logs.typeLengths[parentName][name][valueLength] = logs.typeLengths[parentName][name][valueLength] || 0;
        logs.typeLengths[parentName][name][valueLength]++;
      }
      const integerBinary = unsignedIntegerToBinary(integer, valueLength);
      const binary = [sizeBinary, integerBinary];
      return binary;
    }

    /**
     * Shifts a positive integer from the binary string, returning
     * the integer and the next part of the binary string
     * @param {string} binary
     * @returns {[number, string]}
     */
    shiftValueFromBinary(binary) {
      let sizeBinary;
      [sizeBinary, binary] = shiftBinary(binary, this.sizeBinaryLength);
      const sizeIndex = binaryToUnsignedInteger(sizeBinary);
      const valueLength = this.bitSizes[sizeIndex];
      let integer;
      [integer, binary] = shiftUnsignedIntegerFromBinary(binary, valueLength);
      return [integer, binary];
    }

  }

  /**
   * Converts a variable length positive or negative integer to and from a
   * binary string
   */
  class VariableIntegerType extends FixedIntegerType {

    /**
     * @param {Object} options
     * @param {string} options.name Name identifying the type
     * @param {string} options.binaryType Binary string identifying the type
     * @param {number} options.minValue Minimum value for the integer
     * @param {number} options.maxValue Maximum value for the integer
     * @param {[number]} options.integerBitSizes Expressible storage bit sizes
     */
    constructor(options) {
      super(options);
      this.isNegative = (this.minValue < 0 && this.maxValue === 0);
      this.integer = new LengthAndValueBinary(this, 'integer', options.integerBitSizes);
    }

    /**
     * Converts a positive or negative integer to a array of binary strings
     * @param {number} integer
     * @param {boolean} [logStats] Log the type usage for output to the console
     * @returns {[string]}
     */
    valueToBinary(integer, logStats = null) {
      integer = integer.toFixed(0);
      const binary = this.integer.valueToBinary(Math.abs(integer), logStats);
      if (logStats) {
        this.log(binary);
      }
      return binary;
    }

    /**
     * Shifts a positive or negative integer from the binary string, returning
     * the integer and the next part of the binary string
     * @param {string} binary
     * @returns {[number, string]}
     */
    shiftValueFromBinary(binary) {
      let integer;
      [integer, binary] = this.integer.shiftValueFromBinary(binary);
      if (this.isNegative) {
        integer = -integer;
      }
      return [integer, binary];
    }

  }

  /**
   * Converts a variable length array to and from a binary string
   */
  class VariableArrayType extends VariableIntegerType {

    /**
     * @param {Object} options
     * @param {string} options.name Name identifying the type
     * @param {string} options.binaryType Binary string identifying the type
     * @param {[number]} options.integerBitSizes Expressible storage bit sizes
     */
    constructor(options) {
      super(options);
      this.esType = 'array';
    }

    /**
     * Converts an array to an array of binary strings
     * @param {Array} array
     * @param {boolean} [logStats] Log the type usage for output to the console
     * @returns {[Array|string]}
     */
    valueToBinary(array, logStats = null) {
      const arrayLength = array.length;
      const binary = super.valueToBinary(arrayLength);
      if (arrayLength) {
        const valueType = findValueTypeFromValues(array);
        binary.push(valueType.binaryType);
        binary.type = valueType.name;
        binary.push(array.map(value => valueType.valueToBinary(value, logStats)));
      }
      if (logStats) {
        this.log(binary);
      }
      return binary;
    }

    /**
     * Shifts an array from the binary string, returning
     * the array and the next part of the binary string
     * @param {string} binary
     * @returns {[Array, string]}
     */
    shiftValueFromBinary(binary) {
      let arrayLength;
      [arrayLength, binary] = super.shiftValueFromBinary(binary);
      const value = new Array(arrayLength);
      if (arrayLength) {
        let valueType;
        [valueType, binary] = shiftValueTypeFromBinary(binary);
        for (let i = 0, l = arrayLength; i < l; i++) {
          [value[i], binary] = valueType.shiftValueFromBinary(binary);
        }
      }
      return [value, binary];
    }

  }

  /**
   * Converts a variable length signed integer to and from a binary string
   */
  class VariableSignedIntegerType extends VariableIntegerType {

    /**
     * Converts a signed positive or negative integer to a binary string array
     * @param {number} integer
     * @param {boolean} [logStats] Log the type usage for output to the console
     * @returns {[string]}
     */
    valueToBinary(integer, logStats = null) {
      integer = integer.toFixed(0);
      const isNegative = (integer < 0);
      const signBinary = isNegative ? '1' : '0';
      const integerBinary = this.integer.valueToBinary(Math.abs(integer), logStats);
      const binary = [signBinary, integerBinary];
      if (logStats) {
        this.log(binary);
      }
      return binary;
    }

    /**
     * Shifts the first signed integer value from the binary string, returning
     * the integer value and the next part of the binary string
     * @param {string} binary
     * @returns {[number, string]}
     */
    shiftValueFromBinary(binary) {
      let isNegative;
      [isNegative, binary] = shiftUnsignedIntegerFromBinary(binary, 1);
      let integer;
      [integer, binary] = this.integer.shiftValueFromBinary(binary);
      if (isNegative) {
        integer = -integer;
      }
      return [integer, binary];
    }

  }

  /**
   * Converts a variable length 2 precision decimal to and from a binary string
   */
  class VariableDecimalType extends VariableIntegerType {

    /**
     * @param {Object} options
     * @param {string} options.name Name identifying the type
     * @param {string} options.binaryType Binary string identifying the type
     * @param {number} options.minValue Minimum value for the integer
     * @param {number} options.maxValue Maximum value for the integer
     * @param {[number]} options.integerBitSizes Expressible integer storage bit sizes
     * @param {[number]} options.decimalBitSizes Expressible decimal storage bit sizes
     */
    constructor(options) {
      super(options);
      this.isFloat = true;
      this.decimal = new LengthAndValueBinary(this, 'decimal', options.decimalBitSizes);
    }

    /**
     * Converts a signed 2 precision decimal to an array of binary strings
     * @param {number} float
     * @param {boolean} [logStats] Log the type usage for output to the console
     * @returns {[string]}
     */
    valueToBinary(float, logStats = null) {
      float = float.toFixed(2);
      const isNegative = (float < 0);
      float = Math.abs(float);
      const parts = String(float).split('.');
      const higherInteger = parseInt(parts[0]);
      const lowerInteger = parseInt(zeroPadRightToLength(parts[1] || 0, 2));
      const signBinary = isNegative ? '1' : '0';
      const integerValueBinary = this.integer.valueToBinary(higherInteger, logStats);
      const decimalValueBinary = this.decimal.valueToBinary(lowerInteger, logStats);
      const binary = [signBinary, integerValueBinary, decimalValueBinary];
      if (logStats) {
        this.log(binary);
      }
      return binary;
    }

    /**
     * Shifts the first signed 2 precision decimal value from the binary string,
     * returning the decimal value and the next part of the binary string
     * @param {string} binary
     * @returns {[number, string]}
     */
    shiftValueFromBinary(binary) {
      let isNegative;
      [isNegative, binary] = shiftUnsignedIntegerFromBinary(binary, 1);
      let higherInteger;
      [higherInteger, binary] = this.integer.shiftValueFromBinary(binary);
      let lowerInteger;
      [lowerInteger, binary] = this.decimal.shiftValueFromBinary(binary);
      lowerInteger = zeroPadLeftToLength(String(lowerInteger), 2);
      let float = parseFloat(higherInteger + '.' + lowerInteger);
      if (isNegative) {
        float = -float;
      }
      return [float, binary];
    }

  }

  const arrayType = new VariableArrayType({
    name: 'array',
    binaryType: '10',
    integerBitSizes: [4, 16]
  });

  const booleanType = new FixedBooleanType({
    name: 'boolean',
    binaryType: '0'
  });

  /**
   * @type {[FixedIntegerType|VariableIntegerType]}
   */
  const integerTypes = [
    new FixedIntegerType({
      name: 'uint3',
      binaryType: '1110',
      valueBinaryLength: 3
    }),
    new VariableIntegerType({
      name: 'vint8+',
      binaryType: '110',
      minValue: 0,
      maxValue: 255,
      integerBitSizes: [2, 8]
    }),
    new VariableIntegerType({
      name: 'vint8-',
      binaryType: '111100',
      minValue: -255,
      maxValue: 0,
      integerBitSizes: [2, 8]
    }),
    new VariableSignedIntegerType({
      name: 'sint32',
      binaryType: '111110',
      minValue: -4294967295,
      maxValue: 4294967295,
      integerBitSizes: [2, 4, 16, 32]
    })
  ];

  /**
   * @type {[VariableDecimalType]}
   */
  const decimalTypes = [
    new VariableDecimalType({
      name: 'sdec15',
      binaryType: '111101',
      minValue: -255.99,
      maxValue: 255.99,
      integerBitSizes: [2, 8],
      decimalBitSizes: [0, 7]
    }),
    new VariableDecimalType({
      name: 'sdec39',
      binaryType: '111111',
      minValue: -4294967295.99,
      maxValue: 4294967295.99,
      integerBitSizes: [2, 4, 16, 32],
      decimalBitSizes: [0, 7]
    })
  ];

  // Store and index all of the value types for searching by binaryType and name
  const ValueTypes = [booleanType, arrayType].concat(integerTypes).concat(decimalTypes);
  ValueTypes.nameIndex = {};
  ValueTypes.forEach(valueType => (ValueTypes.nameIndex[valueType.name] = valueType));

  /**
   * Extends the native typeof keyword with array and null
   * @param {*} value
   * @returns {string} "undefined"|"null"|"boolean"|"number"|"array"|"object"
   */
  function esTypeOf(value) {
    if (Array.isArray(value)) {
      return 'array';
    }
    if (value === null) {
      return 'null';
    }
    return typeof value;
  }

  /**
   * Returns matching ValueType for the given name
   * @param {string} name
   * @returns {AbstractValueType}
   */
  function findValueTypeFromName(name) {
    return ValueTypes.nameIndex[name.toLowerCase()];
  }

  /**
   * Returns matching ValueType for the given value
   * @param {number|boolean|Array} value
   * @returns {AbstractValueType}
   */
  function findValueTypeFromValue(value) {
    const esType = esTypeOf(value);
    switch (esType) {
      case 'array':
        return arrayType;
      case 'boolean':
        return booleanType;
    }
    value = value.toFixed(2);
    const isFloat = !Number.isInteger(value);
    const isValueInValueTypeRange = valueType => (value >= valueType.minValue && value <= valueType.maxValue);
    const valueType = isFloat ?
      decimalTypes.find(isValueInValueTypeRange) :
      integerTypes.find(isValueInValueTypeRange);
    if (!valueType) {
      throw new Error(`Cannot find type from value: ${value}`);
    }
    return valueType;
  }

  /**
   * Returns a common ValueType for an array of values
   * @param {Array} values
   * @returns {AbstractValueType}
   */
  function findValueTypeFromValues(values) {
    if (!values.length) {
      return;
    }
    let minValue = 0;
    let maxValue = 0;
    let isFloat = false;
    const esTypes = values.map(value => {
      const valueType = findValueTypeFromValue(value, isFloat);
      if (valueType.esType === 'number') {
        minValue = Math.min(value, minValue);
        maxValue = Math.max(value, maxValue);
        isFloat = isFloat || !Number.isInteger(value);
      }
      return valueType.esType;
    });
    const uniqESTypes = [...new Set(esTypes)];
    if (uniqESTypes.length > 1) {
      throw new Error(`Cannot resolve array to one type: ${uniqESTypes.join()}`);
    }
    const esType = uniqESTypes[0];
    switch (esType) {
      case 'array':
        return arrayType;
      case 'boolean':
        return booleanType;
    }
    const isRangeInValueTypeRange = valueType => (minValue >= valueType.minValue && maxValue <= valueType.maxValue);
    const valueType = isFloat ?
      decimalTypes.find(isRangeInValueTypeRange) :
      integerTypes.find(isRangeInValueTypeRange);
    if (!valueType) {
      throw new Error(`Cannot find type from value. min: ${minValue} max: ${maxValue} isfloat: ${isFloat}`);
    }
    return valueType;
  }

  /**
   * Shifts the first value type representation from the binary string, returning
   * the the ValueType found and next part of the binary string
   * @param {string} binary
   * @returns {[AbstractValueType, string]}
   */
  function shiftValueTypeFromBinary(binary) {
    const valueType = ValueTypes.find(valueType => {
      const binaryType = binary.slice(0, valueType.binaryTypeLength);
      return (binaryType === valueType.binaryType);
    });
    if (!valueType) {
      throw new Error(`Cannot find type from binary: ${binary.slice(0, 6)}...`);
    }
    binary = binary.slice(valueType.binaryTypeLength);
    return [valueType, binary];
  }

  /**
   * Sanitize the input throwing errors on any incorrect variable types whilst
   * cloning the input arrays
   * @param {number|boolean|Array} value
   * @returns {number|boolean|Array}
   */
  function convertValuesToNumbers(value) {
    const esType = esTypeOf(value);
    switch (esType) {
      case 'array':
        return value.map(convertValuesToNumbers);
      case 'undefined':
      case 'null':
        return (value ? 1 : 0);
      case 'boolean':
      case 'number':
        return value;
    }
    throw new Error(`Cannot convert ${esType} to number`);
  }

  /**
   * Main API
   */
  class Converter {

    /**
     * Checks the given value for conversion errors and returns the error
     * @param {string|number|Array} value
     * @returns {undefined|Error}
     */
    getInvalidTypeError(value) {
      try {
        value = convertValuesToNumbers(value);
        (esTypeOf(value) === 'array') ?
          findValueTypeFromValues(value) :
          findValueTypeFromValue(value);
        return;
      } catch (err) {
        return err;
      }
    }

    /**
     * Convert an array, boolean or number into a string binary representation
     * @param {number|boolean|Array} value
     * @param {string} [typeName] To force an internal data type for testing
     * @param {boolean} [logStats] Console logs statistics on type use
     * @returns {string}
     */
    valueToBinary(value, typeName = null, logStats = null) {
      this.clearLog();
      const hasInitialType = (typeof typeName === 'string');
      value = convertValuesToNumbers(value);
      const valueType = hasInitialType ?
        findValueTypeFromName(typeName) :
        findValueTypeFromValue(value);
      if (!valueType) {
        throw new Error(`Could not find value type from ${hasInitialType ? `name ${typeName}` : `value ${value}`} accepts: ${Object.keys(ValueTypes.nameIndex)}. Leave typeName empty for auto-detect.`);
      }
      const binary = valueType.valueToBinary(value, logStats);
      if (!hasInitialType) {
        binary.unshift(valueType.binaryType);
      }
      if (logStats) {
        this.printLog();
      }
      return binary;
    }

    /**
     * Convert the string binary representation back into an array, boolean or number
     * @param {string} binary A string binary representation of data from valueToBinary
     * @param {string} [typeName] To force an internal data type for testing
     * @returns {number|boolean|Array}
     */
    valueFromBinary(binary, typeName = null) {
      binary = _.flatten(binary).join('');
      const hasInitialType = typeof typeName === 'string';
      let valueType;
      if (hasInitialType) {
        valueType = findValueTypeFromName(typeName);
      } else {
        [valueType, binary] = shiftValueTypeFromBinary(binary);
      }
      if (!valueType || !(valueType instanceof AbstractValueType)) {
        throw new Error(`Could not find value type from ${hasInitialType ? `name "${typeName}"` : `binary "${binary.slice(0, 8)}"...`} accepts: ${Object.keys(ValueTypes.nameIndex)}. Leave typeName empty for auto-detect.`);
      }
      const [value] = valueType.shiftValueFromBinary(binary);
      return value;
    }

    /**
     * Clears any previous logs
     */
    clearLog() {
      logs.usedTypes = {};
      logs.typeLengths = {};
      logs.binarySamples = {};
    }

    /**
     * Prints logs from last run
     */
    printLog() {
      console.log('Types used count:', logs.usedTypes);
      console.log('Type lengths used count:', logs.typeLengths);
      console.log('Type binary samples:', logs.binarySamples);
    }

    /**
     * Convert an array, boolean or number into a base64 string
     * @param {number|boolean|Array} value
     * @param {string} [typeName] To force an internal data type for testing
     * @param {boolean} [logStats] Console logs statistics on type use
     * @returns {string}
     */
    serialize(value, typeName = null, logStats = null) {
      const binary = this.valueToBinary(value, typeName, logStats);
      const base64 = binaryToBase64(binary);
      return base64;
    }

    /**
     * Convert an array, boolean or number into a base64 string, asynchronously
     * @param {number|boolean|Array} value
     * @returns {string}
     */
    async serializeAsync(value, typeName = null, logStats = null) {
      const binary = this.valueToBinary(value, null, null);
      const base64 = binaryToBase64(binary);
      const isLargeArray = (Array.isArray(value) && value.length > 10);
      if (isLargeArray) {
        return new Promise(resolve => {
          LZMAWorker.compress(JSON.stringify(value), 1, data => {
            const compressedBase64 = `#${window.btoa(data.map(i => String.fromCharCode(i + 128)).join('')).replace(/=/g, '')}`;
            const isCompressedSmaller = (compressedBase64.length < base64.length);
            if (isCompressedSmaller) return resolve(compressedBase64);
            return resolve(base64);
          });
        });
      }
      return base64;
    }

    /**
     * Convert the base64 string back into an array, boolean or number
     * @param {string} base64 A string representation of data from serialize
     * @param {string} [typeName] To force an internal data type for testing
     * @returns {number|boolean|Array}
     */
    deserialize(base64, typeName = null) {
      const isLZMACompressed = (base64[0] === '#');
      if (isLZMACompressed) return JSON.parse(window.LZMA.decompress(window.atob(base64.slice(1)).split('').map(c => c.charCodeAt(0) - 128)));
      const binary = base64ToBinary(base64);
      const value = this.valueFromBinary(binary, typeName);
      return value;
    }

  }

  return (window.SCORMSuspendData = new Converter());
});
