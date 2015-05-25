/* JSON extended - allows storing and retriving of Regex objects in JSON */

document.body.style.color = 'deeppink';

var JSONX = {
	
	stringify: function(obj){
		return JSON.stringify(JSONX.encodeRegexes(obj));
	},	

	parse: function(string){
		return JSONX.decodeRegexes(JSON.parse(string));
	},

	encodeRegexes: function(obj){
		return JSONX._convert(obj);
	},

	decodeRegexes: function(obj){
		console.log('decodeRegexes');
		console.log(obj);
		ret = JSONX._convert(obj, true);
		console.log(ret);
		console.log('end decodeRegexes');
		return ret;
	},

	_convert: function(obj, deconvert){
		// Recursively go through `obj` and convert all Regex items into {"__regexp__": /pattern/.toString()} OR
		// do the opposite and convert all {"__regexp__", "/pattern/"} items back into /pattern/
		var i, item, return_item;
		deconvert = deconvert || false;
		if(JSONX.type(obj) === 'regexp' && !deconvert){
			return {"__regexp__": obj.toString()};
		}else if(JSONX.type(obj) === 'object' && obj.__regexp__ && deconvert){
			return RegExp(obj.__regexp__.replace(/^\/|\/$/g, '')); // Yey, Javascript
		}else if(JSONX.type(obj) == 'array'){
			return_item = [];
			for(i=0; i<obj.length; i++){
				item = obj[i];
				return_item.push(JSONX._convert(item, deconvert));
			}
			return return_item;
		}else if(JSONX.type(obj) == 'object'){
			return_item = {};
			for(key in obj){
				return_item[key] = JSONX._convert(obj[key], deconvert);
			}
			return return_item;
		}else{
			// Going to assume it's a string/int/normal thing
			return obj;
		}
	},

	type: function(obj){
		// Like `typeof`, but actually works
		return Object.prototype.toString.call(obj)
			.replace('[object ', '').replace(']', '').toLowerCase();
	}
	
};
