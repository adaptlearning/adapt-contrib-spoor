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
   * booleans, arrays of <8 length and numbers of <4 value.
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
   * ARRAY     0             65535 (items)  NO       2             5         23        Array length and valuetype
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
   *   BITS | SMALL LENGTH (UNIT3/16) VALUETYPE = VALUE
   *   5    | 1     000               0         = zero length boolean array
   *   5    | 1     111               0         = 7 length boolean array
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
   *
   * Note:
   * Intentionally written in ES5 for backwards compatibility with earlier versions
   * of Adapt.
   */

  /**
   * @type {[]} A placeholder for capturing returned arrays to perform destructuring assignment.
   *
   * In ES6
   * var a;
   * var b;
   * [ a, b ] = call();
   *
   * In ES5
   * var a;
   * var b;
   * _es5destruct_ = call();
   * a = _es5destruct_[0];
   * b = _es5destruct_[1];
   *
   */
  var _es5destruct_;

  // Cache for zero strings of various lengths
  var ZeroStr = {};
  /**
   * Make and cache a zero string up to the supplied length
   * @param {number} length
   * @returns {string}
   */
  function makeZeroStr(length) {
    return ZeroStr[length] = ZeroStr[length] || (new Array(length + 1)).join('0');
  }
  // Initialize zero string cache up to 64 characters in length
  for (var i = 1, l = 64; i <= l; i++) {
    makeZeroStr(i);
  }

  /**
   * Zero pads to the right, making up to the supplied length
   * @param {string} str
   * @param {number} length
   * @returns {string}
   */
  function zeroPadRightToLen(str, length) {
    var padLen = (length - str.length);
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
    var padLen = (length - str.length);
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
    var padLen = multiple - (str.length % multiple);
    if (padLen !== multiple) {
      str = str + makeZeroStr(padLen);
    }
    return str;
  }

  /**
   * Returns a positive integer from the supplied bin and binLen, returning the integer
   * @param {string} bin
   * @param {number} binLen
   * @returns {number}
   */
  function binToUint(bin, binLen) {
    if (binLen === 0) {
      return 0;
    }
    bin = zeroPadLeftToLen(bin, binLen);
    var integer = parseInt(bin.slice(0, binLen), 2);
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
    var integer = parseInt(bin.slice(0, binLen), 2);
    var bin = bin.slice(binLen);
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
    var shifted = bin.slice(0, binLen);
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
    var bin = Math.abs(integer).toString(2);
    if (typeof binLen === 'undefined') {
      return bin;
    }
    var length = bin.length;
    if (length > binLen) {
      throw new Error('Integer too big for specified binary length. int: ' + integer + ' binlen: ' + binLen);
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
    var arrLength = arr.length;
    var str = new Array(arrLength);
    for (var i = 0, l = arrLength; i < l; i++) {
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
    var strLength = str.length;
    var arr = new Array(strLength);
    for (var i = 0, l = strLength; i < l; i++) {
      arr[i] = str.charCodeAt(i);
    }
    return arr;
  }

  /** @type {number} Number of bits per byte */
  var BYTE_BIT_LENGTH = 8;

  /**
   * Converts a binary string or nested arrays of binary strings to a base64 string
   * @param {string|[string]} bin
   * @returns {string}
   */
  function binToBase64(bin) {
    bin = _.flatten(bin).join('');
    bin = zeroPadRightToMultiple(bin, BYTE_BIT_LENGTH);
    var bytesCount = bin.length / BYTE_BIT_LENGTH;
    var charCodes = new Array(bytesCount);
    for (var i = 0, l = bytesCount; i < l; i++) {
      _es5destruct_ = shiftUintFromBin(bin, BYTE_BIT_LENGTH);
      charCodes[i] = _es5destruct_[0]; bin = _es5destruct_[1];
    }
    var base64 = btoa(byteArrToStr(charCodes))
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
    var charCodes = strToByteArr(atob(base64));
    var bytesCount = charCodes.length;
    var bin = new Array(bytesCount);
    for (var i = 0, l = bytesCount; i < l; i++) {
      bin[i] = uintToBin(charCodes[i], BYTE_BIT_LENGTH);
    }
    bin = bin.join('');
    return bin;
  }

  // Console output store
  var logs = {
    usedTypes: {},
    typeLengths: {},
    binarySamples: {}
  };

  /**
   * An abstract base class for a ValueType value to and from binary string converter
   * @param {Object} options
   * @param {string} options.name Name identifying the type
   * @param {string} options.binType Binary string identifying the type
   */
  function AbstractValueType(options) {
    _.extend(this, options);
    this.binTypeLength = this.binType.length;
  };
  /**
   * Adds a record of the binary string production to the logging store
   * @param {[Array|string]} bin
   */
  AbstractValueType.prototype.log = function(bin) {
    var name = this.name;
    logs.usedTypes[name] = logs.usedTypes[name] || 0;
    logs.usedTypes[name]++;
    logs.binarySamples[name] = logs.binarySamples[name] || [];
    logs.binarySamples[name].push(bin);
  };

  /**
   * Converts a fixed length positive integer to and from a binary string.
   * @param {Object} options
   * @param {string} options.name Name identifying the type
   * @param {string} options.binType Binary string identifying the type
   * @param {number} options.valueBinLength Bit length of the integer
   */
  function FixedIntegerType(options) {
    AbstractValueType.call(this, options);
    this.esType = 'number';
    if (!this.valueBinLength) {
      return;
    }
    this.minValue = options.minValue || 0;
    this.maxValue = options.maxValue || Math.pow(2, this.valueBinLength) - 1;
  }
  FixedIntegerType.prototype = Object.create(AbstractValueType.prototype);
  /**
   * Converts a fixed length positive integer to a binary string array.
   * @param {number} integer
   * @param {boolean} [logStats] Log the type usage for output to the console
   * @returns {[string]}
   */
  FixedIntegerType.prototype.valueToBin = function(integer, logStats) {
    var bin = uintToBin(integer, this.valueBinLength);
    logStats && this.log(bin);
    bin = [bin];
    return bin;
  };
  /**
   * Shifts a fixed length positive integer from the binary string, returning
   * the integer and the next part of the binary string.
   * @param {string} bin
   * @returns {[number, string]}
   */
  FixedIntegerType.prototype.shiftValueFromBin = function(bin) {
    var _es5destruct_ = shiftUintFromBin(bin, this.valueBinLength);
    var int = _es5destruct_[0]; bin = _es5destruct_[1];
    return [int, bin];
  };

  /**
   * Converts a boolean to and from a binary string.
   * @param {Object} options
   * @param {string} options.name Name identifying the type
   * @param {string} options.binType Binary string identifying the type
   */
  function FixedBooleanType(options) {
    options.valueBinLength = 1;
    FixedIntegerType.call(this, options);
    this.esType = 'boolean';
  }
  FixedBooleanType.prototype = Object.create(FixedIntegerType.prototype);
  /**
   * Shifts a boolean from the binary string, returning
   * the boolean and the next part of the binary string.
   * @param {string} bin
   * @returns {[boolean, string]}
   */
  FixedBooleanType.prototype.shiftValueFromBin = function(bin)  {
    var bool = (bin[0] === '1' ? true : false);
    bin = bin.slice(1);
    return [bool, bin];
  };

  /**
   * A helper for converting variable length positive integers to and from a binary string.
   * @param {string} parent The parent AbstractValueType
   * @param {string} name The sub parent value part name "inc" or "dec"
   * @param {[number]} bitSizes An ordered array of expressible bit lengths
   */
  function LengthAndValueBin(parent, name, bitSizes) {
    this.parent = parent;
    this.name = name;
    this.bitSizes = bitSizes;
    this.maxValues = _.flatten(this.bitSizes).map(function(value) {
      return Math.pow(2, value) - 1;
    }),
    this.maxValue = this.maxValues[this.maxValues.length-1]
    this.sizeBinLen = uintToBin(this.bitSizes.length-1).length;
  };
  /**
   * Converts a positive integer to a binary string array.
   * @param {number} integer
   * @param {boolean} [logStats] Log the type usage for output to the console
   * @returns {[string]}
   */
  LengthAndValueBin.prototype.valueToBin = function(integer) {
    var parentName = this.parent.name;
    var sizeIndex = _.findIndex(this.maxValues, function(maxValue) {
      return (integer <= maxValue);
    });
    if (sizeIndex === -1) {
      throw new Error('Value is to large for type: ' + parentName + ' value: ' + integer + ' max: ' + this.maxValue);
    }
    var sizeBin = uintToBin(sizeIndex, this.sizeBinLen);
    var valueLen = this.bitSizes[sizeIndex];
    var name = this.name;
    logs.typeLengths[parentName] = logs.typeLengths[parentName] || {};
    logs.typeLengths[parentName][name] = logs.typeLengths[parentName][name] || {};
    logs.typeLengths[parentName][name][valueLen] = logs.typeLengths[parentName][name][valueLen] || 0;
    logs.typeLengths[parentName][name][valueLen]++;
    var integerBin = uintToBin(integer, valueLen);
    var bin = [sizeBin, integerBin];
    return bin;
  };
  /**
   * Shifts a positive integer from the binary string, returning
   * the integer and the next part of the binary string.
   * @param {string} bin
   * @returns {[number, string]}
   */
  LengthAndValueBin.prototype.shiftValueFromBin = function(bin) {
    _es5destruct_ = shiftBin(bin, this.sizeBinLen);
    var sizeBin = _es5destruct_[0]; bin = _es5destruct_[1];
    var sizeIndex = binToUint(sizeBin);
    var valueLen = this.bitSizes[sizeIndex];
    _es5destruct_ = shiftUintFromBin(bin, valueLen);
    var int = _es5destruct_[0]; bin = _es5destruct_[1];
    return [int, bin];
  };

  /**
   * Converts a variable length positive or negative integer to and from a binary string.
   * @param {Object} options
   * @param {string} options.name Name identifying the type
   * @param {string} options.binType Binary string identifying the type
   * @param {number} options.minValue Minimum value for the integer
   * @param {number} options.maxValue Maximum value for the integer
   * @param {[number]} options.intBitSizes Expressible storage bit sizes
   */
  function VariableIntegerType(options) {
    FixedIntegerType.call(this, options);
    this.isNegative = this.minValue < 0 && this.maxValue === 0;
    this.int = new LengthAndValueBin(this, 'int', options.intBitSizes);
  }
  VariableIntegerType.prototype = Object.create(FixedIntegerType.prototype);
  /**
   * Converts a positive or negative integer to a binary string array.
   * @param {number} integer
   * @param {boolean} [logStats] Log the type usage for output to the console
   * @returns {[string]}
   */
  VariableIntegerType.prototype.valueToBin = function(integer, logStats) {
    integer = integer.toFixed(0);
    var bin = this.int.valueToBin(Math.abs(integer));
    logStats && this.log(bin);
    return bin;
  };
  /**
   * Shifts a positive or negative integer from the binary string, returning
   * the integer and the next part of the binary string.
   * @param {string} bin
   * @returns {[number, string]}
   */
  VariableIntegerType.prototype.shiftValueFromBin = function(bin) {
    _es5destruct_ = this.int.shiftValueFromBin(bin);
    var int = _es5destruct_[0]; bin = _es5destruct_[1];
    if (this.isNegative) {
      int = -int;
    }
    return [int, bin];
  };

  /**
   * Converts a variable length array to and from a binary string.
   * @param {Object} options
   * @param {string} options.name Name identifying the type
   * @param {string} options.binType Binary string identifying the type
   * @param {[number]} options.intBitSizes Expressible storage bit sizes
   */
  function VariableArrayType(options) {
    VariableIntegerType.call(this, options);
    this.esType = 'array';
  }
  VariableArrayType.prototype = Object.create(VariableIntegerType.prototype);
  /**
   * Converts an array to a binary string array.
   * @param {Array} arr
   * @param {boolean} [logStats] Log the type usage for output to the console
   * @returns {[Array|string]}
   */
  VariableArrayType.prototype.valueToBin = function(arr, logStats) {
    var arrLength = arr.length;
    var bin = VariableIntegerType.prototype.valueToBin.call(this, arrLength);
    if (arrLength) {
      var valueType = findValueTypeFromValues(arr);
      bin.push(valueType.binType);
      bin.type = valueType.name;
      bin.push(arr.map(function(value) {
        return valueType.valueToBin(value, logStats);
      }));
    }
    logStats && this.log(bin);
    return bin;
  };
  /**
   * Shifts an array from the binary string, returning
   * the array and the next part of the binary string.
   * @param {string} bin
   * @returns {[Array, string]}
   */
  VariableArrayType.prototype.shiftValueFromBin = function(bin) {
    _es5destruct_ = VariableIntegerType.prototype.shiftValueFromBin.call(this, bin);
    var arrLength = _es5destruct_[0]; bin = _es5destruct_[1];
    var value = new Array(arrLength);
    if (arrLength) {
      _es5destruct_ = shiftValueTypeFromBin(bin);
      var valueType = _es5destruct_[0]; bin = _es5destruct_[1];
      for (var i = 0, l = arrLength; i < l; i++) {
        _es5destruct_ = valueType.shiftValueFromBin(bin);
        value[i] = _es5destruct_[0]; bin = _es5destruct_[1];
      }
    }
    return [value, bin];
  };

  /**
   * Converts a variable length signed integer to and from a binary string.
   * @param {Object} options
   * @param {string} options.name Name identifying the type
   * @param {string} options.binType Binary string identifying the type
   * @param {number} options.minValue Minimum value for the integer
   * @param {number} options.maxValue Maximum value for the integer
   * @param {[number]} options.intBitSizes Expressible storage bit sizes
   */
  function VariableSignedIntegerType(options) {
    VariableIntegerType.call(this, options);
  }
  VariableSignedIntegerType.prototype = Object.create(VariableIntegerType.prototype);
  /**
   * Converts a signed positive or negative integer to a binary string array.
   * @param {number} integer
   * @param {boolean} [logStats] Log the type usage for output to the console
   * @returns {[string]}
   */
  VariableSignedIntegerType.prototype.valueToBin = function(integer, logStats) {
    integer = integer.toFixed(0);
    var isNegative = (integer < 0);
    var signBin = isNegative ? '1' : '0';
    var integerBin = this.int.valueToBin(Math.abs(integer));
    var bin = [signBin, integerBin];
    logStats && this.log(bin);
    return bin;
  };
  /**
   * Shifts the first signed integer value from the binary string, returning
   * the next part of the binary string and the integer value.
   * @param {string} bin
   * @returns {[number, string]}
   */
  VariableSignedIntegerType.prototype.shiftValueFromBin = function(bin) {
    _es5destruct_ = shiftUintFromBin(bin, 1);
    var isNegative = _es5destruct_[0]; bin = _es5destruct_[1];
    _es5destruct_ = this.int.shiftValueFromBin(bin);
    var int = _es5destruct_[0]; bin = _es5destruct_[1];
    if (isNegative) {
      int = -int;
    }
    return [int, bin];
  };

  /**
   * Converts a variable length 2 precision decimal to and from a binary string.
   * @param {Object} options
   * @param {string} options.name Name identifying the type
   * @param {string} options.binType Binary string identifying the type
   * @param {number} options.minValue Minimum value for the integer
   * @param {number} options.maxValue Maximum value for the integer
   * @param {[number]} options.intBitSizes Expressible integer storage bit sizes
   * @param {[number]} options.decBitSizes Expressible decimal storage bit sizes
   */
  function VariableDecimalType(options) {
    VariableIntegerType.call(this, options);
    this.isFloat = true;
    this.dec = new LengthAndValueBin(this, 'dec',options.decBitSizes);
  }
  VariableDecimalType.prototype = Object.create(VariableIntegerType.prototype);
  /**
   * Converts a signed 2 precision decimal to a binary string array.
   * @param {number} float
   * @param {boolean} [logStats] Log the type usage for output to the console
   * @returns {[string]}
   */
  VariableDecimalType.prototype.valueToBin = function(float, logStats) {
    float = float.toFixed(2);
    var isNegative = (float < 0);
    float = Math.abs(float);
    var parts = String(float).split('.');
    var higherInt = parseInt(parts[0]);
    var lowerInt = parseInt(zeroPadRightToLen(parts[1] || 0, 2));
    var signBin = isNegative ? '1' : '0';
    var intValueBin = this.int.valueToBin(higherInt);
    var decValueBin = this.dec.valueToBin(lowerInt);
    var bin = [signBin, intValueBin, decValueBin];
    logStats && this.log(bin);
    return bin;
  };
  /**
   * Shifts the first signed 2 precision decimal value from the binary string, returning
   * the decimal value and the next part of the binary string.
   * @param {string} bin
   * @returns {[number, string]}
   */
  VariableDecimalType.prototype.shiftValueFromBin = function(bin) {
    _es5destruct_ = shiftUintFromBin(bin, 1);
    var isNegative = _es5destruct_[0]; bin = _es5destruct_[1];
    _es5destruct_ = this.int.shiftValueFromBin(bin);
    var higherInt = _es5destruct_[0]; bin = _es5destruct_[1];
    _es5destruct_ = this.dec.shiftValueFromBin(bin);
    var lowerInt = _es5destruct_[0]; bin = _es5destruct_[1];
    lowerInt = zeroPadLeftToLen(String(lowerInt), 2);
    var float = parseFloat(higherInt + '.' + lowerInt);
    if (isNegative) {
      float = -float;
    }
    return [float, bin];
  };

  var arrayType = new VariableArrayType({
    name:  'ARRAY',
    binType: '10',
    intBitSizes: [3,16]
  });

  var booleanType = new FixedBooleanType({
    name: 'BOOLEAN',
    binType: '0'
  });

  /**
   * @type {[FixedIntegerType|VariableIntegerType]}
   */
  var integerTypes = [
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
  var decimalTypes = [
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
  var ValueTypes = [booleanType, arrayType].concat(integerTypes).concat(decimalTypes);
  ValueTypes.nameIndex = {};
  ValueTypes.forEach(function (valueType) {
    ValueTypes.nameIndex[valueType.name] = valueType;
  });

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
    var esType = esTypeOf(value);
    switch (esType) {
      case 'array':
        return arrayType;
      case 'boolean':
        return booleanType;
    }
    value = value.toFixed(2);
    var isFloat = !Number.isInteger(value);
    var valueType = isFloat ?
      _.find(decimalTypes, function(valueType) {
        return (value >= valueType.minValue && value <= valueType.maxValue);
      }) :
      _.find(integerTypes, function(valueType) {
        return (value >= valueType.minValue && value <= valueType.maxValue);
      });
    if (!valueType) {
      throw new Error('Cannot find type from value: ' + value);
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
    var minValue = 0;
    var maxValue = 0;
    var isFloat = false;
    var esTypes = values.map(function(value) {
      var valueType = findValueTypeFromValue(value, isFloat);
      if (valueType.esType === 'number') {
        minValue = _.min([valueType.minValue, minValue]);
        maxValue = _.max([valueType.maxValue, maxValue]);
        isFloat = isFloat || valueType.isFloat;
      }
      return valueType.esType;
    });
    var uniqESTypes = _.uniq(esTypes);
    if (uniqESTypes.length > 1) {
      throw new Error('Cannot resolve array to one type: ' + uniqESTypes.join());
    }
    var esType = uniqESTypes[0];
    switch (esType) {
      case 'array':
        return arrayType;
      case 'boolean':
        return booleanType;
    }
    var valueType = isFloat ?
      _.find(decimalTypes, function(valueType) {
        return (minValue >= valueType.minValue && maxValue <= valueType.maxValue);
      }) :
      _.find(integerTypes, function(valueType) {
        return (minValue >= valueType.minValue && maxValue <= valueType.maxValue);
      });
    if (!valueType) {
      throw new Error('Cannot find type from value. min: ' + minValue + ' max: ' + maxValue + ' isfloat: ' + isFloat);
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
    var valueType = _.find(ValueTypes, function(valueType) {
      var binType = bin.slice(0, valueType.binTypeLength);
      return (binType === valueType.binType);
    });
    if (!valueType) {
      throw new Error('Cannot find type from binary: ' + bin.slice(0, 6) + '...');
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
    var esType = esTypeOf(value);
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
    throw new Error('Cannot convert ' + esType + ' to number');
  }

  /**
   * Main API
   */
  function Converter() {}
  /**
   * Checks the given value for conversion errors and returns the error
   * @param {string|number|Array} value
   * @returns {undefined|Error}
   */
  Converter.prototype.getInvalidTypeError = function(value) {
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
  };
  /**
   * Convert an array, boolean or number into a string binary representation
   * @param {number|boolean|Array} value
   * @param {string} [typeName] To force an internal data type for testing
   * @param {boolean} [logStats] Console logs statistics on type use
   * @returns {string}
   */
  Converter.prototype.valueToBin = function(value, typeName, logStats) {
    this.clearLog();
    var hasInitialType = (typeof typeName === 'string');
    value = convertValuesToNumbers(value);
    var valueType;
    if (hasInitialType) {
      valueType = findValueTypeFromName(typeName);
      if (!valueType) {
        throw new Error('Could not find value type from name "' + typeName + '" accepts: ' + Object.keys(ValueTypes.nameIndex) + '. Leave empty for auto-detect.');
      }
    } else {
      valueType = findValueTypeFromValue(value);
      if (!valueType) {
        throw new Error('Could not find value type from value "' + value + '" accepts: ' + Object.keys(ValueTypes.nameIndex) + '. Leave empty for auto-detect.');
      }
    }
    var bin = valueType.valueToBin(value, logStats);
    if (!hasInitialType) {
      bin.unshift(valueType.binType);
    }
    logStats && this.printLog();
    return bin;
  };
  /**
   * Convert the string binary representation back into an array, boolean or number.
   * @param {string} bin A string binary representation of data from valueToBin
   * @param {string} [typeName] To force an internal data type for testing
   * @returns {number|boolean|Array}
   */
  Converter.prototype.valueFromBin = function(bin, typeName) {
    bin = _.flatten(bin).join('');
    var valueType;
    if (typeof typeName === 'string') {
      valueType = findValueTypeFromName(typeName);
      if (!valueType) {
        throw new Error('Could not find value type from name "' + typeName + '" accepts: ' + Object.keys(ValueTypes.nameIndex) + '. Leave empty for auto-detect.');
      }
    } else {
      _es5destruct_ = shiftValueTypeFromBin(bin);
      valueType = _es5destruct_[0]; bin = _es5destruct_[1];
      if (!valueType || !(valueType instanceof AbstractValueType)) {
        throw new Error('Could not find value type from value "' + value + '" accepts: ' + Object.keys(ValueTypes.nameIndex) + '. Leave empty for auto-detect.');
      }
    }
    _es5destruct_ = valueType.shiftValueFromBin(bin);
    var value = _es5destruct_[0];
    return value;
  };
  /**
   * Clears any previous logs
   */
  Converter.prototype.clearLog = function() {
    logs.usedTypes = {};
    logs.typeLengths = {};
    logs.binarySamples = {};
  };
  /**
   * Prints logs from last run
   */
  Converter.prototype.printLog = function() {
    console.log('Types used count:', logs.usedTypes);
    console.log('Type lengths used count:', logs.typeLengths);
    console.log('Type binary samples:', logs.binarySamples);
  };
  /**
   * Convert an array, boolean or number into a base64 string
   * @param {number|boolean|Array} value
   * @param {string} [typeName] To force an internal data type for testing
   * @param {boolean} [logStats] Console logs statistics on type use
   * @returns {string}
   */
  Converter.prototype.serialize = function(value, typeName, logStats = true) {
    var bin = this.valueToBin(value, typeName, logStats);
    var base64 = binToBase64(bin);
    return base64;
  };
  /**
   * Convert the base64 string back into an array, boolean or number.
   * @param {string} base64 A string representation of data from serialize
   * @param {string} [typeName] To force an internal data type for testing
   * @returns {number|boolean|Array}
   */
  Converter.prototype.deserialize = function(base64, typeName) {
    var bin = base64ToBin(base64);
    var value = this.valueFromBin(bin, typeName);
    return value;
  };

  window.SCORMSuspendData = new Converter();
})();
