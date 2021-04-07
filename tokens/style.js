let id = 0

function Style (attrs, body, line, column) {
	this.type = 'style'
	this.attrs = attrs
	this.body = body
	this.line = line
	this.column = column
	this.id = id++
}

module.exports = Style
