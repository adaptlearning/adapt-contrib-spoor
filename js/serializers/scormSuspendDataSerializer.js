//https://raw.githubusercontent.com/oliverfoster/SCORMSuspendDataSerializer 2015-06-27
(function(_) {

	function toPrecision(number, precision) {
		if (precision === undefined) precision = 2
		var multiplier = 1 * Math.pow(10, precision);
		return Math.round(number * multiplier) / multiplier;
	}

	function BinaryToNumber(bin, length) {
		return parseInt(bin.substr(0, length), 2);
	}

	function NumberToBinary(number, length) {
		return Padding.fillLeft( number.toString(2), length );
	}

	var Padding = {
		addLeft: function PaddingAddLeft(str, x , char) {
			char = char || "0";
			return (new Array( x + 1)).join(char) + str;
		},
		addRight: function PaddingAddRight(str, x, char) {
			char = char || "0";
			return  str + (new Array( x + 1)).join(char);
		},
		fillLeft: function PaddingFillLeft(str, x, char) {
			if (str.length < x) {
	        	var paddingLength = x - str.length;
	        	return Padding.addLeft(str, paddingLength, char)
	        }
	        return str;
		},
		fillRight: function PaddingFillLeft(str, x, char) {
			if (str.length < x) {
	        	var paddingLength = x - str.length;
	        	return Padding.addRight(str, paddingLength, char)
	        }
	        return str;
		},
		fillBlockLeft: function PaddingFillBlockRight(str, x, char) {
			if (str.length % x) {
	        	var paddingLength = x - (str.length % x);
	        	return Padding.addLeft(str, paddingLength, char)
	        }
	        return str;
		},
		fillBlockRight: function PaddingFillBlockRight(str, x, char) {
			if (str.length % x) {
	        	var paddingLength = x - (str.length % x);
	        	return Padding.addRight(str, paddingLength, char)
	        }
	        return str;
		}
	};

	function Base64() {
		switch (arguments.length) {
		case 1:
			var firstArgumentType = typeof arguments[0];
			switch (firstArgumentType) {
			case "number":
				return Base64._indexes[arguments[0]];
			case "string":
				return Base64._chars[arguments[0]];
			default:
				throw "Invalid arguments type";
			}
		case 2:
			var char = arguments[0];
			var index = arguments[1];
			Base64._chars[char] = index;
			Base64._indexes[index] = char;
			return;
		default:
			throw "Invalid number of arguments";
		}
	}
	Base64._chars = {};
	Base64._indexes = {};
	(function() {
		var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
		for (var i = 0, l = alphabet.length; i<l; i++) {
			Base64(alphabet[i], i);
		}
	})();


	function DataType() {
		switch (arguments.length) {
		case 1:
			switch (typeof  arguments[0]) {
			case "object":
				var item = arguments[0]
				if (DataType._types[item.type] === undefined) DataType._types[item.type] = [];
				DataType._types[item.type].push(item);
				item.index = DataType._indexes.length
				DataType._indexes.push(item);
				DataType[item.name] = item;
				return;
			case "string":
				return DataType.getName(arguments[0]);
			case "number":
				return DataType.getIndex(arguments[0]);
			default:
				throw "Argument type not allowed";
			}
		default:
			throw "Too many arguments";
		}
		
	}
	DataType.VARIABLELENGTHDESCRIPTORSIZE = 8;
	DataType._types = {};
	DataType._indexes = [];
	DataType.getName = function DataTypeGetName(name) {
		if (DataType[name])
			return DataType[name];
		throw "Type name not found '"+name+"'";
	};
	DataType.getIndex = function DataTypeGetIndex(index) {
		if (DataType._indexes[index])
			return DataType._indexes[index];
		throw "Type index not found '"+index+"'";
	};
	DataType.getTypes = function DataTypeGetTypes(type) {
		if (DataType._types[type])
			return DataType._types[type];
		throw "Type not found '"+type+"'";
	};
	DataType.checkBounds = function DataTypeCheckBounds(name, number) {
		var typeDef = DataType(name);
		if (number > typeDef.max) throw name + " value is larger than "+typeDef.max;
		if (number < typeDef.min) throw name + " value is smaller than "+typeDef.min;
	};
	DataType.getNumberType = function DataTypeGetNumberType(number) {
		var isDecimal = (number - Math.floor(number)) !== 0;
		var numberDataTypes = DataType.getTypes("number");
		for (var t = 0, type; type = numberDataTypes[t++];) {
			if (number <= type.max && number >= type.min && (!isDecimal || isDecimal == type.decimal) ) {
				return type;
			}
		}
	};
	DataType.getVariableType = function DataTypeGetVariableType(variable) {
		var variableNativeType = variable instanceof Array ? "array" : typeof variable;
		var variableDataType;

		switch(variableNativeType) {
		case "number":
			variableDataType = DataType.getNumberType(variable);
			break;
		case "string":
			variableDataType = DataType.getName("string");
			break;
		default: 
			var supportedItemDataTypes = DataType.getTypes(variableNativeType);
			switch (supportedItemDataTypes.length) {
			case 1:
				variableDataType = supportedItemDataTypes[0];
				break;
			default:
				throw "Type not found '"+variableNativeType+"'";
			}
		}
	
		if (!variableDataType) throw "Cannot assess type '"+variableNativeType+"'";

		return variableDataType;
	};
	DataType.getArrayType = function getArrayType(arr) {
		var foundItemTypes = [];

		for (var i = 0, l = arr.length; i < l; i++) {
			var item = arr[i];
			var itemDataType = DataType.getVariableType(item);

			if (_.findWhere(foundItemTypes, { name: itemDataType.name })) continue;
	
			foundItemTypes.push(itemDataType);
		}

		switch (foundItemTypes.length) {
		case 0:
			throw "Cannot determine array data types";
		case 1:
			//single value type
		 	return foundItemTypes[0];
		default: 
			//many value types
			var nativeTypeNames = _.pluck(foundItemTypes, 'type');
			var uniqueNativeTypeNames = _.uniq(nativeTypeNames);
			var hasManyNativeTypes = (uniqueNativeTypeNames.length > 1);

			if (hasManyNativeTypes) return DataType("variable"); //multiple types in array

			//single native type in array, multiple datatype lengths
			switch (uniqueNativeTypeNames[0]) {
			case "number":
				var foundDecimal = _.findWhere(foundItemTypes, { decimal: true});
				if (foundDecimal) return foundDecimal;
				return _.max(foundItemTypes, function(type) {
					return type.max;
				});
			}

			throw "Unsupported data types";
		}
		
	};
	(function() {
		var types = [
			{
				"size": "fixed",
				"length": 1,
				"name": "boolean",
				"type": "boolean"
			},
			{
				"max": 15,
				"min": 0,
				"decimal": false,
				"size": "fixed",
				"length": 4,
				"name": "half",
				"type": "number"
			},
			{
				"max": 255,
				"min": 0,
				"decimal": false,
				"size": "fixed",
				"length": 8,
				"name": "byte",
				"type": "number"
			},
			{
				"max": 65535,
				"min": 0,
				"decimal": false,
				"size": "fixed",
				"length": 16,
				"name": "short",
				"type": "number"
			},
			{
				"max": 4294967295,
				"min": 0,
				"decimal": false,
				"size": "fixed",
				"length": 32,
				"name": "long",
				"type": "number"
			},
			{
				"max": 4294967295,
				"min": -4294967295,
				"decimal": true,
				"precision": 2,
				"size": "variable",
				"name": "double",
				"type": "number"
			},
			{
				"name": "base16",
				"size": "variable",
				"type": "string"
			},
			{
				"name": "base64",
				"size": "variable",
				"type": "string"
			},
			{
				"name": "array",
				"size": "variable",
				"type": "array"
			},
			{
				"name": "variable",
				"size": "variable",
				"type": "variable"
			},
			{
				"name": "string",
				"size": "variable",
				"type": "string"
			}
		];
		for (var i = 0, type; type = types[i++];) {
			DataType(type);
		}
	})();

	

	function Converter(fromType, toType) {
		fromType = Converter.translateTypeAlias(fromType);
		toType = Converter.translateTypeAlias(toType);

		var args = [].slice.call(arguments, 2);

		if (fromType != "binary" && toType != "binary") {
			if (!Converter._converters[fromType]) throw "Type not found '" + fromType + "'";
			if (!Converter._converters[fromType]['binary']) throw "Type not found 'binary'";
			
			var bin = Converter._converters[fromType]['binary'].call(this, args[0], Converter.WRAPOUTPUT);

			if (!Converter._converters['binary'][toType]) throw "Type not found '"+toType+"'";

			return Converter._converters['binary'][toType].call(this, bin, Converter.WRAPOUTPUT);
		}

		if (!Converter._converters[fromType]) throw "Type not found '" + fromType + "'";
		if (!Converter._converters[fromType][toType]) throw "Type not found '" + toType + "'";

		return Converter._converters[fromType][toType].call(this, args[0], Converter.WRAPOUTPUT);
	}
	Converter.WRAPOUTPUT = false;
	Converter.translateTypeAlias = function ConverterTranslateTypeAlias(type) {
		type = type.toLowerCase();
		for (var Type in Converter._typeAliases) {
			if (Type == type || (" "+Converter._typeAliases[Type].join(" ")+" ").indexOf(" "+type+" ") >= 0 ) return Type;
		}
		throw "Type not found '" + type + "'";
	};
	Converter._typeAliases = {
		"base64": [ "b64" ],
		"base16" : [ "hex", "b16" ],
		"double": [ "dbl", "decimal", "d" ],
		"long": [ "lng", "l" ],
		"short": [ "s" ],
		"byte" : [ "b" ],
		"half": [ "h" ],
		"number": [ "num", "n" ],
		"binary": [ "bin" ],
		"boolean": [ "bool" ],
		"array": [ "arr" ]
	};
	Converter._variableWrapLength = function ConverterVariableWrapLength(bin) {
		var variableLength = bin.length;
		var binLength = NumberToBinary(variableLength, DataType.VARIABLELENGTHDESCRIPTORSIZE)

		return binLength + bin;
	};
	Converter._variableLength = function ConverterVariableLength(bin) {
		var VLDS =  DataType.VARIABLELENGTHDESCRIPTORSIZE;
		var variableLength = BinaryToNumber(bin, VLDS );
		return variableLength;
	};
	Converter._variableUnwrapLength = function ConverterVariableUnwrapLength(bin) {
		var VLDS =  DataType.VARIABLELENGTHDESCRIPTORSIZE;
		var variableLength = BinaryToNumber(bin, VLDS );

		return bin.substr( VLDS, variableLength);
	};
	Converter._converters = {
		"base64": {
			"binary": function ConverterBase64ToBinary(base64) { //TODO PADDING... ?
				var firstByte = Base64(base64.substr(0,1));
				var binFirstByte = NumberToBinary(firstByte, 6);
				var paddingLength = BinaryToNumber(binFirstByte, 6);

			    var bin = "";
			    for (var i = 0, ch; ch = base64[i++];) {
			        var block = Base64(ch).toString(2);
			        block = Padding.fillLeft(block, 6);
			        bin += block;
			    }
			    bin =  bin.substr(6+paddingLength);
			    return bin;
			}
		},
		"base16": {
			"binary": function ConverterBase16ToBinary(hex) {
				var firstByte = Base64(base64.substr(0,1));
				var binFirstByte = NumberToBinary(firstByte, 4);
				var paddingLength = BinaryToNumber(binFirstByte, 4);

			    var bin = "";
			    for (var i = 0, ch; ch = hex[i++];) {
			        var block = parseInt(ch, 16).toString(2);
			        block = Padding.fillLeft(block, 4);
			        bin += block;
			    }

			     bin =  bin.substr(6+paddingLength);
			    return bin;
			}
		},
		"double": {
			"binary": function ConverterDoubleToBinary(dbl, wrap) {
				var typeDef = DataType("double");
				DataType.checkBounds("double", dbl);

				dbl = toPrecision(dbl, typeDef.precision);

				var dblStr = dbl.toString(10);

				var isMinus = dbl < 0;
			
				var baseStr, exponentStr, highStr, lowStr, decimalPosition, hasDecimal;

				
				var exponentPos = dblStr.indexOf("e");
				if (exponentPos > -1) {
					//exponential float representation "nE-x"
					baseStr = dblStr.substr(0, exponentPos);
					exponentStr = Math.abs(dblStr.substr(exponentPos+1));

					if (isMinus) baseStr = baseStr.substr(1);

					decimalPosition = baseStr.indexOf(".");
					hasDecimal = (decimalPosition > -1);

					if (hasDecimal) {
						highStr = baseStr.substr(0, decimalPosition);
						lowStr = baseStr.substr(decimalPosition+1);

						exponentStr = (Math.abs(exponentStr) + lowStr.length);

						baseStr = highStr + lowStr;
					}

				} else {
					//normal long float representation "0.00000000"
					baseStr = dblStr;
					exponentStr = "0";

					if (isMinus) dblStr = dblStr.substr(1);

					decimalPosition = dblStr.indexOf(".");
					hasDecimal = (decimalPosition > -1);
					if (hasDecimal) {
						highStr = dblStr.substr(0, decimalPosition);
						lowStr = dblStr.substr(decimalPosition+1);

						exponentStr = (lowStr.length);
						if (highStr == "0") {
							baseStr = parseInt(lowStr, 10).toString(10);
						} else {
							baseStr = highStr + lowStr;
						}
					} else {
						baseStr = dblStr;
					}

				}

				var bin = [];

				var binLong = Padding.fillBlockLeft (parseInt(baseStr, 10).toString(2), 4);
				var binMinus = isMinus ? "1" : "0";
				var binExponent = Padding.fillLeft( parseInt(exponentStr, 10).toString(2), 7);
				
				bin.push( binMinus );
				bin.push( binExponent );
				bin.push( binLong );

				if (wrap === false) {
					return bin.join("");
				} else {
					return Converter._variableWrapLength(bin.join(""));
				}
			}
		},
		"long": {
			"binary": function ConverterLongToBinary(value) {
				var typeDef = DataType("long");
				DataType.checkBounds("long", value);
				value = toPrecision(value, 0);
				return Padding.fillLeft(value.toString(2), typeDef.length);
			}
		},
		"short": {
			"binary": function ConverterShortToBinary(value) {
				var typeDef = DataType("short");
				DataType.checkBounds("short", value);
				value = toPrecision(value, 0);
				return Padding.fillLeft(value.toString(2), typeDef.length);
			}
		},
		"byte": {
			"binary": function ConverterByteToBinary(value) {
				var typeDef = DataType("byte");
				DataType.checkBounds("byte", value);
				value = toPrecision(value, 0);
				return Padding.fillLeft(value.toString(2), typeDef.length);
			}
		},
		"half": {
			"binary": function ConverterHalfToBinary(value) {
				var typeDef = DataType("half");
				DataType.checkBounds("half", value);
				value = toPrecision(value, 0);
				return Padding.fillLeft(value.toString(2), typeDef.length);
			}
		},
		"boolean": {
			"binary": function ConverterBooleanToBinary(bool) {
				return bool ? "1" : "0";
			},
		},
		"array": {
			"binary": function ConverterArrayToBinary(arr, wrap) { //TODO PADDING NOT GOOD
				var typeDef = DataType("array");
				var arrayItemType = DataType.getArrayType(arr);
				var isVariableArray = arrayItemType.name == "vairable";

				if (isVariableArray) {
					var bin = half2bin(15);
					//variable array
					return bin;
				} else {
					var binArrayIdentifier = Converter._converters['half']['binary'](arrayItemType.index);

					var binItemsArray = [];
					for (var i = 0, l = arr.length; i < l; i++) {
						var item = arr[i];
						var binItem = Converter._converters[arrayItemType.name]['binary'](item);
						//console.log("binItem", binItem);
						binItemsArray.push( binItem );
					}

					var binItems = binItemsArray.join("");

					var paddingLength = 0;
					if (binItems.length % 4) paddingLength = 4 - (binItems.length % 4);
					var binPaddingLen = NumberToBinary(paddingLength, 2);

					var binPadding = (new Array(paddingLength+1)).join("0");

					var bin = [];
					bin.push(binArrayIdentifier);
					bin.push(binPaddingLen);
					bin.push(binPadding);
					bin.push(binItems);

					var finished = bin.join("");
					//console.log("unwrapped", finished);

					if (wrap === false) return finished;

					var wrapped = Converter._variableWrapLength( finished);
					//console.log("wrapped", wrapped);

					return wrapped;
				}

			}
		},
		"binary": {
			"array": function ConverterBinaryToArray(bin, wrap) { //TODO PADDING NOT GOOD
				var typeDef = DataType("array");

				//console.log("wrapped", bin);
				if (wrap !== false)
					bin = Converter._variableUnwrapLength( bin);
				//console.log("unwrapped", bin);

				var binArrayIdentifier = bin.substr(0, 4);
				var binPaddingLen = bin.substr(4 , 2);

				var arrayIdentifier = Converter._converters['binary'][ 'half' ]( binArrayIdentifier );
				var paddingLength = BinaryToNumber( binPaddingLen, 2 );

				var dataStart = 4 + 2 + paddingLength;
				var dataLength = bin.length - dataStart;

				var binItems = bin.substr(dataStart, dataLength );

				var arrayItemType = DataType(arrayIdentifier);
				var isVariableArray = arrayItemType.name == "variable";

				var rtn = [];
				if (isVariableArray) {

				} else {
					var hasVariableLengthChildren = arrayItemType.size == "variable";
					if (hasVariableLengthChildren) {
						var VLDS = DataType.VARIABLELENGTHDESCRIPTORSIZE;
						while ( binItems != "" ) {
							
							var variableLength = Converter._variableLength( binItems );
							var binItem = binItems.substr(0, VLDS + variableLength);
							binItems = binItems.substr(VLDS+variableLength);
							//console.log("binItem", binItem, BinaryToNumber(binItem, 16));

							rtn.push( Converter._converters['binary'][ arrayItemType.name ]( binItem) );
						}
					} else {
						while ( binItems != "" ) {
							var binItem = binItems.substr(0, arrayItemType.length);
							binItems = binItems.substr(arrayItemType.length);

							rtn.push( Converter._converters['binary'][ arrayItemType.name ](binItem) );
						}
					}

				}


				return rtn;

			},
			"base64": function ConverterBinaryToBase64(bin) { //TODO PADDING NOT GOOD
				var paddingLength = 0;
				if (bin.length % 6) paddingLength = 6 - (bin.length % 6);
				binPaddingLen = NumberToBinary(paddingLength, 6);
				binPadding = Padding.addLeft("", paddingLength);
				bin = binPaddingLen + binPadding + bin;

				var binLength = bin.length;
			    var base64 = "";
			    for (var b = 0; b < 10000; b++) {
			        if (b*6 >= binLength) break;
			     
			        var block = bin.substr(b*6,6);
			        base64 += Base64(parseInt(block, 2));
			    }

			    return base64;
			},
			"base16": function ConverterBinaryToBase16(bin) {
				var paddingLength = 0;
				if (bin.length % 4) paddingLength = 4 - (bin.length % 4);
				binPaddingLen = NumberToBinary(paddingLength, 4);
				binPadding = Padding.addLeft("", paddingLength);
				bin = binPaddingLen + binPadding + bin;

			    var binLength = bin.length;
			    var hex = "";
			    for (var b = 0; b < 10000; b++) {
			        if (b*4 >= binLength) break;
			     
			        var block = bin.substr(b*4,4);
			        hex += parseInt(block, 2).toString(16);
			    }
			    return hex;
			},
			"double": function ConverterBinaryToDouble(bin, wrap) {
				var typeDef = DataType("double");
				
				if (wrap !== false)
					bin = Converter._variableUnwrapLength(bin);

				var isMinus = bin.substr(0 ,1) == 1;

				var exponentByte = parseInt("0" + bin.substr(1, 7), 2);
				var baseLong = parseInt( bin.substr(8, bin.length), 2);

				var dbl = parseFloat(baseLong+"E-"+exponentByte, 10);
				if (isMinus) dbl = dbl * -1;

				return dbl;
			},
			"long": function ConverterBinaryToLong(bin) {
				return parseInt(bin.substr(0, 32), 2);
			},
			"short": function ConverterBinaryToShort(bin) {
				return parseInt(bin.substr(0, 16), 2);
			},
			"byte": function ConverterBinaryToByte(bin) {
				return parseInt(bin.substr(0, 8), 2);
			},
			"half": function ConverterBinaryToHalf(bin) {
				return parseInt(bin.substr(0, 4), 2);
			},
			"boolean": function ConverterBinaryToBoolean(bin) {
				return bin.substr(0,1) == "1" ? true: false;
			},
			"number": function ConverterBinaryToNumber(bin) {
				return parseInt(bin, 2);
			}
		}
	};
	
	window.SCORMSuspendData = {
		serialize: function SCORMSuspendDataSerialize(arr) {
			return Converter ("array", "base64", arr);
		},
		deserialize: function SCORMSuspendDataDeserialize(base64) {
			return Converter("base64", "array", base64);
		},
		Base64: Base64,
		Converter: Converter,
		DataType: DataType
	};


})(_);
