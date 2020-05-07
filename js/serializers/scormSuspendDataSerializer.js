(function() {
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
   *  DATA = ( ARRAY | BOOLEAN | UNIT3 | VINT8+ | VINT8- | SDEC15 | SINT32 | SDEC39 )
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
   *   BITS | SMALL LENGTH (UNIT4/16) VALUETYPE = VALUE
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
   *  UNIT3
   *   A value from 0 to 7 with a 3 bit fixed length output.
   *
   *          BINARY
   *   BITS | INT (UINT3) = VALUE
   *   3    | 000         = 0
   *   3    | 111         = 7
   *
   *  UNIT4
   *   An array length from 0 to 15 with a 4 bit fixed length output.
   *
   *          BINARY
   *   BITS | INT (UINT4) = VALUE
   *   4    | 0000        = 0
   *   4    | 1111        = 15
   *
   *  VINT8+
   *   A value from 0 to 255 with variable length output.
   *   Output is a UNIT2/8 bit integer with a 1 bit header.
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
   *   Output is a UNIT2/8 bit integer with a 1 bit header.
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
   *   BITS | SIGN INTSIZE INT (UINT2/8) DECSIZE DEC (UNIT0/7)   = VALUE
   *   5    | 0    0       00            0                       =  0
   *   12   | 0    0       00            0       0000001         =  0.01
   *   12   | 1    0       00            0       0000001         = -0.01
   *   12   | 1    0       00            1       1100011         = -0.99
   *   18   | 0    1       00001000      1       0000001         =  8.01
   *   18   | 1    1       00001000      1       1100011         = -8.99
   *   18   | 0    1       11111111      1       1100011         =  255.99
   *   18   | 1    1       11111111      1       1100011         = -255.99
   *
   *  UNIT16
   *   An array length from 0 to 65535 with a 16 bit fixed length output.
   *
   *          BINARY
   *   BITS | INT (UINT16)       = VALUE
   *   16   | 0000000000000000  = 0
   *   16   | 1111111111111111  = 65535
   *
   *  SINT32
   *   A value from -4294967295 to 4294967295 with variable length output.
   *   Output is a UNIT2/4/16/32 bit integer with a 3 bit header.
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
   *   BITS | SIGN INTSIZE INT (UINT2/4/16/32)              DECSIZE DEC (UNIT0/7)   = VALUE
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
   * 8 characters:
   *
   *   jk4chX0Q
   *
   * These characters can be deserialized back into the nested arrays above using
   * SCORMSuspendData.deserialize("jk4chX0Q");
   *
   * In JSON this array would usually be 63 characters minified, at 8 characters this is
   * a reduction of about 88%. At the worse case, storing an array containing just
   * the largest possible number ([-4294967295.99]) the output will only be reduced
   * by about 37% (h///////xg) when compared to the equivalent JSON. It is possible
   * to store 500 of the above mcq state arrays in just 3755 characters. About 270
   * question states will occupy just half of the available space in SCORM's 4096
   * character suspend data.
   */

  // Cache for zero strings of various lengths
  const ZeroStr = {};
  /**
   * Make and cache a zero string up to the supplied length
   * @param {number} length
   * @returns {string}
   */
  function makeZeroStr(length) {
    return ZeroStr[length] = ZeroStr[length] || (new Array(length + 1)).join('0');
  }
  // Initialize zero string cache up to 64 characters in length
  for (let i = 1, l = 64; i <= l; i++) {
    makeZeroStr(i);
  }

  /**
   * Zero pads to the right, making up to the supplied length
   * @param {string} str
   * @param {number} length
   * @returns {string}
   */
  function zeroPadRightToLen(str, length) {
    const padLen = (length - str.length);
    if (padLen > 0) {
      str = str + makeZeroStr(padLen);
    }
    return str;
  }

  /**
   * Zero pads to the left, making up to the supplied length
   * @param {string} str
   * @param {number} length
   * @returns {string}
   */
  function zeroPadLeftToLen(str, length) {
    const padLen = (length - str.length);
    if (padLen > 0) {
      str = makeZeroStr(padLen) + str;
    }
    return str;
  }

  /**
   * Zero pads to the right at even multiples
   * @param {string} str
   * @param {number} multiple
   * @returns {string}
   */
  function zeroPadRightToMultiple(str, multiple) {
    const padLen = multiple - (str.length % multiple);
    if (padLen !== multiple) {
      str = str + makeZeroStr(padLen);
    }
    return str;
  }

  /**
   * Returns a positive integer from the supplied bin and binLen
   * @param {string} bin
   * @param {number} binLen
   * @returns {number}
   */
  function binToUint(bin, binLen) {
    if (binLen === 0) {
      return 0;
    }
    bin = zeroPadLeftToLen(bin, binLen);
    const integer = parseInt(bin.slice(0, binLen), 2);
    return integer;
  }

  /**
   * Shifts a positive integer from the supplied bin and binLen, returning the shifted integer
   * and the truncated remaining string
   * @param {string} bin
   * @param {number} binLen
   * @returns {[number, string]}
   */
  function shiftUintFromBin(bin, binLen) {
    if (binLen === 0) {
      return [0, bin];
    }
    bin = zeroPadLeftToLen(bin, binLen);
    const integer = parseInt(bin.slice(0, binLen), 2);
    bin = bin.slice(binLen);
    return [integer, bin];
  }

  /**
   * Shifts binLen characters from the supplied bin, returning the shifted string
   * and the truncated remaining string.
   * @param {string} bin
   * @param {number} binLen
   * @returns {[string, string]}
   */
  function shiftBin(bin, binLen) {
    if (binLen === 0) {
      return ['', bin];
    }
    bin = zeroPadLeftToLen(bin, binLen);
    const shifted = bin.slice(0, binLen);
    bin = bin.slice(binLen);
    return [shifted, bin];
  }

  /**
   * Converts a positive integer to a binary string
   * @param {number} integer
   * @param {number} [binLen] Length of the output string
   */
  function uintToBin(integer, binLen) {
    if (binLen === 0) {
      return '';
    }
    let bin = Math.abs(integer).toString(2);
    if (typeof binLen === 'undefined') {
      return bin;
    }
    const length = bin.length;
    if (length > binLen) {
      throw new Error(`Integer too big for specified binary length. int: ${integer} binlen: ${binLen}`);
    }
    bin = zeroPadLeftToLen(bin, binLen);
    return bin;
  }

  /**
   * Converts a byte array to a string
   * @param {[number]} arr
   * @returns {string}
   */
  function byteArrToStr(arr) {
    const arrLength = arr.length;
    let str = new Array(arrLength);
    for (let i = 0, l = arrLength; i < l; i++) {
      str[i] = String.fromCharCode(arr[i]);
    }
    str = str.join('');
    return str;
  }

  /**
   * Converts a string to a byte array
   * @param {string} str
   * @returns {[number]}
   */
  function strToByteArr(str) {
    const strLength = str.length;
    const arr = new Array(strLength);
    for (let i = 0, l = strLength; i < l; i++) {
      arr[i] = str.charCodeAt(i);
    }
    return arr;
  }

  /** @type {number} Number of bits per byte */
  const BYTE_BIT_LENGTH = 8;

  /**
   * Converts a binary string or nested arrays of binary strings to a base64 string
   * @param {string|[string]} bin
   * @returns {string}
   */
  function binToBase64(bin) {
    bin = _.flatten(bin).join('');
    bin = zeroPadRightToMultiple(bin, BYTE_BIT_LENGTH);
    const bytesCount = bin.length / BYTE_BIT_LENGTH;
    const charCodes = new Array(bytesCount);
    for (let i = 0, l = bytesCount; i < l; i++) {
      [ charCodes[i], bin ] = shiftUintFromBin(bin, BYTE_BIT_LENGTH);
    }
    let base64 = btoa(byteArrToStr(charCodes))
    // Remove padding = or == as not necessary here
    base64 = base64.replace(/=/g,'');
    // Can't handle base64 with the + sign so swap with a -
    base64 = base64.replace(/\+/g,'-');
    return base64;
  }

  /**
   * Converts a base64 string to a binary string
   * @param {string} base64
   * @returns {string}
   */
  function base64ToBin(base64) {
    // base64 should have a + instead of a -
    base64 = base64.replace(/\-/g,'+');
    const charCodes = strToByteArr(atob(base64));
    const bytesCount = charCodes.length;
    let bin = new Array(bytesCount);
    for (let i = 0, l = bytesCount; i < l; i++) {
      bin[i] = uintToBin(charCodes[i], BYTE_BIT_LENGTH);
    }
    bin = bin.join('');
    return bin;
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
     * @param {string} options.binType Binary string identifying the type
     */
    constructor(options) {
      Object.assign(this, options);
      this.binTypeLength = this.binType.length;
    }

    /**
     * Adds a record of the binary string production to the logging store
     * @param {[Array|string]} bin
     */
    log(bin) {
      const name = this.name;
      logs.usedTypes[name] = logs.usedTypes[name] || 0;
      logs.usedTypes[name]++;
      logs.binarySamples[name] = logs.binarySamples[name] || [];
      logs.binarySamples[name].push(bin);
    }

  };

  /**
   * Converts a fixed length positive integer to and from a binary string.
   */
  class FixedIntegerType extends AbstractValueType {

    /**
     * @param {Object} options
     * @param {string} options.name Name identifying the type
     * @param {string} options.binType Binary string identifying the type
     * @param {number} options.valueBinLength Bit length of the integer
     */
    constructor(options) {
      super(options);
      this.esType = 'number';
      if (!this.valueBinLength) {
        return;
      }
      this.minValue = options.minValue || 0;
      this.maxValue = options.maxValue || Math.pow(2, this.valueBinLength) - 1;
    }

    /**
     * Converts a fixed length positive integer to a binary string array.
     * @param {number} integer
     * @param {boolean} [logStats] Log the type usage for output to the console
     * @returns {[string]}
     */
    valueToBin(integer, logStats = null) {
      let bin = uintToBin(integer, this.valueBinLength);
      logStats && this.log(bin);
      bin = [bin];
      return bin;
    }

    /**
     * Shifts a fixed length positive integer from the binary string, returning
     * the integer and the next part of the binary string.
     * @param {string} bin
     * @returns {[number, string]}
     */
    shiftValueFromBin(bin) {
      let int;
      [int, bin] = shiftUintFromBin(bin, this.valueBinLength);
      return [int, bin];
    }

  }

  /**
   * Converts a boolean to and from a binary string.
   */
  class FixedBooleanType extends FixedIntegerType {

    /**
     * @param {Object} options
     * @param {string} options.name Name identifying the type
     * @param {string} options.binType Binary string identifying the type
     */
    constructor(options) {
      options.valueBinLength = 1;
      super(options);
      this.esType = 'boolean';
    }

    /**
     * Shifts a boolean from the binary string, returning
     * the boolean and the next part of the binary string.
     * @param {string} bin
     * @returns {[boolean, string]}
     */
    shiftValueFromBin(bin)  {
      const bool = (bin[0] === '1' ? true : false);
      bin = bin.slice(1);
      return [bool, bin];
    }

  }

  /**
   * A helper for converting variable length positive integers to and from a binary string.
   */
  class LengthAndValueBin {

    /**
     * @param {string} parent The parent AbstractValueType
     * @param {string} name The sub parent value part name "inc" or "dec"
     * @param {[number]} bitSizes An ordered array of expressible bit lengths} parent
     */
    constructor(parent, name, bitSizes) {
      this.parent = parent;
      this.name = name;
      this.bitSizes = bitSizes;
      this.maxValues = _.flatten(this.bitSizes).map(value => (Math.pow(2, value) - 1));
      this.maxValue = this.maxValues[this.maxValues.length-1]
      this.sizeBinLen = uintToBin(this.bitSizes.length-1).length;
    }

    /**
     * Converts a positive integer to a binary string array.
     * @param {number} integer
     * @param {boolean} [logStats] Log the type usage for output to the console
     * @returns {[string]}
     */
    valueToBin(integer, logStats = null) {
      const parentName = this.parent.name;
      const sizeIndex = this.maxValues.findIndex(maxValue => (integer <= maxValue));
      if (sizeIndex === -1) {
        throw new Error('Value is too large for type: ' + parentName + ' value: ' + integer + ' max: ' + this.maxValue);
      }
      const sizeBin = uintToBin(sizeIndex, this.sizeBinLen);
      const valueLen = this.bitSizes[sizeIndex];
      const name = this.name;
      if (logStats) {
        logs.typeLengths[parentName] = logs.typeLengths[parentName] || {};
        logs.typeLengths[parentName][name] = logs.typeLengths[parentName][name] || {};
        logs.typeLengths[parentName][name][valueLen] = logs.typeLengths[parentName][name][valueLen] || 0;
        logs.typeLengths[parentName][name][valueLen]++;
      }
      const integerBin = uintToBin(integer, valueLen);
      const bin = [sizeBin, integerBin];
      return bin;
    }

    /**
     * Shifts a positive integer from the binary string, returning
     * the integer and the next part of the binary string.
     * @param {string} bin
     * @returns {[number, string]}
     */
    shiftValueFromBin(bin) {
      let sizeBin;
      [sizeBin, bin] = shiftBin(bin, this.sizeBinLen);
      const sizeIndex = binToUint(sizeBin);
      const valueLen = this.bitSizes[sizeIndex];
      let int;
      [int, bin] = shiftUintFromBin(bin, valueLen);
      return [int, bin];
    }

  }

  /**
   * Converts a variable length positive or negative integer to and from a binary string.
   */
  class VariableIntegerType extends FixedIntegerType {

    /**
     * @param {Object} options
     * @param {string} options.name Name identifying the type
     * @param {string} options.binType Binary string identifying the type
     * @param {number} options.minValue Minimum value for the integer
     * @param {number} options.maxValue Maximum value for the integer
     * @param {[number]} options.intBitSizes Expressible storage bit sizes
     */
    constructor(options) {
      super(options);
      this.isNegative = this.minValue < 0 && this.maxValue === 0;
      this.int = new LengthAndValueBin(this, 'int', options.intBitSizes);
    }

    /**
     * Converts a positive or negative integer to a binary string array.
     * @param {number} integer
     * @param {boolean} [logStats] Log the type usage for output to the console
     * @returns {[string]}
     */
    valueToBin(integer, logStats = null) {
      integer = integer.toFixed(0);
      let bin = this.int.valueToBin(Math.abs(integer), logStats);
      logStats && this.log(bin);
      return bin;
    }

    /**
     * Shifts a positive or negative integer from the binary string, returning
     * the integer and the next part of the binary string.
     * @param {string} bin
     * @returns {[number, string]}
     */
    shiftValueFromBin(bin) {
      let int;
      [int, bin] = this.int.shiftValueFromBin(bin);
      if (this.isNegative) {
        int = -int;
      }
      return [int, bin];
    }

  }

  /**
   * Converts a variable length array to and from a binary string.
   */
  class VariableArrayType extends VariableIntegerType {

    /**
     * @param {Object} options
     * @param {string} options.name Name identifying the type
     * @param {string} options.binType Binary string identifying the type
     * @param {[number]} options.intBitSizes Expressible storage bit sizes
     */
    constructor(options) {
      super(options);
      this.esType = 'array';
    }

    /**
     * Converts an array to a binary string array.
     * @param {Array} arr
     * @param {boolean} [logStats] Log the type usage for output to the console
     * @returns {[Array|string]}
     */
    valueToBin(arr, logStats = null) {
      const arrLength = arr.length;
      const bin = super.valueToBin(arrLength);
      if (arrLength) {
        const valueType = findValueTypeFromValues(arr);
        bin.push(valueType.binType);
        bin.type = valueType.name;
        bin.push(arr.map(value => valueType.valueToBin(value, logStats)));
      }
      logStats && this.log(bin);
      return bin;
    }

    /**
     * Shifts an array from the binary string, returning
     * the array and the next part of the binary string.
     * @param {string} bin
     * @returns {[Array, string]}
     */
    shiftValueFromBin(bin) {
      let arrLength;
      [arrLength, bin] = super.shiftValueFromBin(bin);
      const value = new Array(arrLength);
      if (arrLength) {
        let valueType;
        [valueType, bin] = shiftValueTypeFromBin(bin);
        for (let i = 0, l = arrLength; i < l; i++) {
          [value[i], bin] = valueType.shiftValueFromBin(bin);
        }
      }
      return [value, bin];
    }

  }

  /**
   * Converts a variable length signed integer to and from a binary string.
   */
  class VariableSignedIntegerType extends VariableIntegerType {

    /**
     * @param {Object} options
     * @param {string} options.name Name identifying the type
     * @param {string} options.binType Binary string identifying the type
     * @param {number} options.minValue Minimum value for the integer
     * @param {number} options.maxValue Maximum value for the integer
     * @param {[number]} options.intBitSizes Expressible storage bit sizes
     */
    constructor (options) {
      super(options);
    }

    /**
     * Converts a signed positive or negative integer to a binary string array.
     * @param {number} integer
     * @param {boolean} [logStats] Log the type usage for output to the console
     * @returns {[string]}
     */
    valueToBin(integer, logStats = null) {
      integer = integer.toFixed(0);
      const isNegative = (integer < 0);
      const signBin = isNegative ? '1' : '0';
      const integerBin = this.int.valueToBin(Math.abs(integer), logStats);
      const bin = [signBin, integerBin];
      logStats && this.log(bin);
      return bin;
    }

    /**
     * Shifts the first signed integer value from the binary string, returning
     * the next part of the binary string and the integer value.
     * @param {string} bin
     * @returns {[number, string]}
     */
    shiftValueFromBin(bin) {
      let isNegative;
      [isNegative, bin] = shiftUintFromBin(bin, 1);
      let int;
      [int, bin] = this.int.shiftValueFromBin(bin);
      if (isNegative) {
        int = -int;
      }
      return [int, bin];
    }

  }

  /**
   * Converts a variable length 2 precision decimal to and from a binary string.
   */
  class VariableDecimalType extends VariableIntegerType {

    /**
     * @param {Object} options
     * @param {string} options.name Name identifying the type
     * @param {string} options.binType Binary string identifying the type
     * @param {number} options.minValue Minimum value for the integer
     * @param {number} options.maxValue Maximum value for the integer
     * @param {[number]} options.intBitSizes Expressible integer storage bit sizes
     * @param {[number]} options.decBitSizes Expressible decimal storage bit sizes
     */
    constructor(options) {
      super(options);
      this.isFloat = true;
      this.dec = new LengthAndValueBin(this, 'dec',options.decBitSizes);
    }

    /**
     * Converts a signed 2 precision decimal to a binary string array.
     * @param {number} float
     * @param {boolean} [logStats] Log the type usage for output to the console
     * @returns {[string]}
     */
    valueToBin(float, logStats = null) {
      float = float.toFixed(2);
      const isNegative = (float < 0);
      float = Math.abs(float);
      const parts = String(float).split('.');
      const higherInt = parseInt(parts[0]);
      const lowerInt = parseInt(zeroPadRightToLen(parts[1] || 0, 2));
      const signBin = isNegative ? '1' : '0';
      const intValueBin = this.int.valueToBin(higherInt, logStats);
      const decValueBin = this.dec.valueToBin(lowerInt, logStats);
      const bin = [signBin, intValueBin, decValueBin];
      logStats && this.log(bin);
      return bin;
    }

    /**
     * Shifts the first signed 2 precision decimal value from the binary string, returning
     * the decimal value and the next part of the binary string.
     * @param {string} bin
     * @returns {[number, string]}
     */
    shiftValueFromBin(bin) {
      let isNegative;
      [isNegative, bin] = shiftUintFromBin(bin, 1);
      let higherInt;
      [higherInt, bin] = this.int.shiftValueFromBin(bin);
      let lowerInt;
      [lowerInt, bin]= this.dec.shiftValueFromBin(bin);
      lowerInt = zeroPadLeftToLen(String(lowerInt), 2);
      let float = parseFloat(higherInt + '.' + lowerInt);
      if (isNegative) {
        float = -float;
      }
      return [float, bin];
    }

  }

  const arrayType = new VariableArrayType({
    name:  'array',
    binType: '10',
    intBitSizes: [4,16]
  });

  const booleanType = new FixedBooleanType({
    name: 'boolean',
    binType: '0'
  });

  /**
   * @type {[FixedIntegerType|VariableIntegerType]}
   */
  const integerTypes = [
    new FixedIntegerType({
      name: 'uint3',
      binType: '1110',
      valueBinLength: 3
    }),
    new VariableIntegerType({
      name: 'vint8+',
      binType: '110',
      minValue: 0,
      maxValue: 255,
      intBitSizes: [2,8]
    }),
    new VariableIntegerType({
      name: 'vint8-',
      binType: '111100',
      minValue: -255,
      maxValue: 0,
      intBitSizes: [2,8]
    }),
    new VariableSignedIntegerType({
      name: 'sint32',
      binType: '111110',
      minValue: -4294967295,
      maxValue: 4294967295,
      intBitSizes: [2,4,16,32]
    })
  ];

  /**
   * @type {[VariableDecimalType]}
   */
  const decimalTypes = [
    new VariableDecimalType({
      name: 'sdec15',
      binType: '111101',
      minValue: -255.99,
      maxValue: 255.99,
      intBitSizes: [2,8],
      decBitSizes: [0,7]
    }),
    new VariableDecimalType({
      name: 'sdec39',
      binType: '111111',
      minValue: -4294967295.99,
      maxValue: 4294967295.99,
      intBitSizes: [2,4,16,32],
      decBitSizes: [0,7]
    })
  ];

  // Store and index all of the value types for searching by binType and name.
  const ValueTypes = [booleanType, arrayType].concat(integerTypes).concat(decimalTypes);
  ValueTypes.nameIndex = {};
  ValueTypes.forEach(valueType => (ValueTypes.nameIndex[valueType.name] = valueType));

  /**
   * Extends the native typeof keyword with array and null.
   * @param {*} value
   * @returns {string} "undefined"|"null"|"boolean"|"number"|"array"|"object"
   */
  function esTypeOf(value) {
    return Array.isArray(value) ?
      'array' :
      value === null ?
        'null' :
        typeof value;
  }

  /**
   * Returns matching ValueType for the given name.
   * @param {string} name
   * @returns {AbstractValueType}
   */
  function findValueTypeFromName(name) {
    return ValueTypes.nameIndex[name.toLowerCase()];
  }

  /**
   * Returns matching ValueType for the given value.
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
    const valueType = isFloat ?
      decimalTypes.find(valueType => (value >= valueType.minValue && value <= valueType.maxValue)) :
      integerTypes.find(valueType => (value >= valueType.minValue && value <= valueType.maxValue));
    if (!valueType) {
      throw new Error(`Cannot find type from value: ${value}`);
    }
    return valueType;
  }

  /**
   * Returns a common ValueType for an array of values.
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
        minValue = _.min([valueType.minValue, minValue]);
        maxValue = _.max([valueType.maxValue, maxValue]);
        isFloat = isFloat || valueType.isFloat;
      }
      return valueType.esType;
    });
    const uniqESTypes = _.uniq(esTypes);
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
    const valueType = isFloat ?
      decimalTypes.find(valueType => (minValue >= valueType.minValue && maxValue <= valueType.maxValue)) :
      integerTypes.find(valueType => (minValue >= valueType.minValue && maxValue <= valueType.maxValue));
    if (!valueType) {
      throw new Error(`Cannot find type from value. min: ${minValue} max: ${maxValue} isfloat: ${isFloat}`);
    }
    return valueType;
  }

  /**
   * Shifts the first value type representation from the binary string, returning
   * the the ValueType found and next part of the binary string.
   * @param {string} bin
   * @returns {[AbstractValueType, string]}
   */
  function shiftValueTypeFromBin(bin) {
    const valueType = ValueTypes.find(valueType => {
      const binType = bin.slice(0, valueType.binTypeLength);
      return (binType === valueType.binType);
    });
    if (!valueType) {
      throw new Error(`Cannot find type from binary: ${bin.slice(0, 6)}...`);
    }
    bin = bin.slice(valueType.binTypeLength);
    return [valueType, bin];
  }

  /**
   * Sanitize the input throwing errors on any incorrect variable types and cloning
   * input arrays.
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
        if (esTypeOf(value) === 'array') {
          findValueTypeFromValues(value);
        } else {
          findValueTypeFromValue(value);
        }
        return;
      } catch(err) {
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
    valueToBin(value, typeName = null, logStats = null) {
      this.clearLog();
      const hasInitialType = (typeof typeName === 'string');
      value = convertValuesToNumbers(value);
      let valueType;
      if (hasInitialType) {
        valueType = findValueTypeFromName(typeName);
        if (!valueType) {
          throw new Error(`Could not find value type from name "${typeName}" accepts: ${Object.keys(ValueTypes.nameIndex)}. Leave empty for auto-detect.`);
        }
      } else {
        valueType = findValueTypeFromValue(value);
        if (!valueType) {
          throw new Error(`Could not find value type from value "${value}" accepts: ${Object.keys(ValueTypes.nameIndex)}. Leave empty for auto-detect.`);
        }
      }
      const bin = valueType.valueToBin(value, logStats);
      if (!hasInitialType) {
        bin.unshift(valueType.binType);
      }
      logStats && this.printLog();
      return bin;
    }

    /**
     * Convert the string binary representation back into an array, boolean or number.
     * @param {string} bin A string binary representation of data from valueToBin
     * @param {string} [typeName] To force an internal data type for testing
     * @returns {number|boolean|Array}
     */
    valueFromBin(bin, typeName = null) {
      bin = _.flatten(bin).join('');
      let valueType;
      if (typeof typeName === 'string') {
        valueType = findValueTypeFromName(typeName);
        if (!valueType) {
          throw new Error(`Could not find value type from name "${typeName}" accepts: ${Object.keys(ValueTypes.nameIndex)}. Leave empty for auto-detect.`);
        }
      } else {
        [valueType, bin]= shiftValueTypeFromBin(bin);
        if (!valueType || !(valueType instanceof AbstractValueType)) {
          throw new Error(`Could not find value type from value "${value}" accepts: ${Object.keys(ValueTypes.nameIndex)}. Leave empty for auto-detect.`);
        }
      }
      let value;
      [value] = valueType.shiftValueFromBin(bin);
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
      const bin = this.valueToBin(value, typeName, logStats);
      const base64 = binToBase64(bin);
      return base64;
    }

    /**
     * Convert the base64 string back into an array, boolean or number.
     * @param {string} base64 A string representation of data from serialize
     * @param {string} [typeName] To force an internal data type for testing
     * @returns {number|boolean|Array}
     */
    deserialize(base64, typeName = null) {
      const bin = base64ToBin(base64);
      const value = this.valueFromBin(bin, typeName);
      return value;
    }

  }

  window.SCORMSuspendData = new Converter();
})();
