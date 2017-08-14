/**
 * @return {string}
 */
Element.prototype.toString = function toString () {
	var flag = this.flag

	switch (flag) {
		case ElementComponent:
			return (componentMount(this), this.children.toString())
		case ElementText:
			return escape(this.children)
	}

	var type = this.type
	var children = this.children
	var length = children.length
	var output = flag < ElementFragment ? '<' + type + toProps(this, this.props) + '>' : ''

	switch (bool(type)) {
		case 0:
			return output
		default:
			if (!this.html)
				while (length-- > 0)
					output += (children = children.next).toString()
			else
				output += this.html
	}

	if (flag < ElementFragment)
		output += '</'+type+'>'

	return output
}

/**
 * @param {Element} element
 * @param  {Object} props
 * @return {String}
 */
function toProps (element, props) {
	var value, output = ''

	for (var key in props) {
		switch (value = props[key], key) {
			case 'dangerouslySetInnerHTML':
				if (value && value.__html)
					value = value.__html
				else
					break
			case 'innerHTML':
				element.html = value
				break
			case 'defaultValue':
				if (!props.value)
					output += ' value="'+escape(value)+'"'
			case 'key':
			case 'ref':
			case 'children':
				break
			case 'style':
				output += ' style="' + (typeof value === 'string' ? value : toStyle(value)) + '"'				
				break
			case 'className':
				key = 'class'
			default:
				if (value !== false && value != null)
					output += ' '+ key + (value !== true ? '="'+escape(value)+'"' : '')
				else
					continue
		}
	}

	return output
}

/**
 * @param {Object} obj
 * @return {string}
 */
function toStyle (obj) {
	var name, output = ''

	for (var key in obj) {
		if (key !== key.toLowerCase())
			name = key.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').replace(/^(ms|webkit|moz)/, '-$1').toLowerCase()
		else
			name = key
		
		output += name+':'+obj[key]+';'
	}

	return output
}