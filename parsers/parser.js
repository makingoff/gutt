const parser = require('./parser2')
const fs = require('fs')
const throwError = require('../helpers/throw-error')

function validateTemplateStructure (tree) {
	if (~tree.firstChild.type === 'tag' || tree.firstChild.name === 'component') {
		return tree.firstChild.firstChild
	}

	return tree.firstChild
}

function Parser (source, filePath, rootPath) {
	this.source = source
	this.result = source
	this.filePath = filePath || ''
	this.rootPath = rootPath || ''

	if (typeof this.source === 'string') {
		try {
			this.result = parser(this.source)
			this.result = validateTemplateStructure(this.result)
		} catch (e) {
			throwError(e, this.source, this.filePath, this.rootPath)
		}
	}

	return this
}

Parser.prototype.getRootPath = function () {
	return this.rootPath
}

Parser.prototype.filePath = function () {
	return this._filePath
}

Parser.prototype.stringifyWith = function (stringifier) {
	try {
		return stringifier(this.result, this.source, this.filePath, this.rootPath)
	} catch (e) {
		throwError(e, this.source, this.filePath, this.rootPath)
	}
}

module.exports = {
	parse: function (str, filePath, rootPath) {
		return new Parser(str, filePath, rootPath)
	},

	parseFile: function (filePath, rootPath) {
		return this.parse(fs.readFileSync(filePath, 'utf-8').trim(), filePath, rootPath)
	}
}
