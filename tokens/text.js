function Text (text, line, column) {
	this.type = 'text'
	this.text = text.replace(/\\-/g, '-')
	this.line = line
	this.column = column

	this.parentNode = null
	this.nextSibling = null
	this.previousSibling = null
}

module.exports = Text
