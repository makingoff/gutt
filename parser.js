const Style = require('./tokens/Style')
const Script = require('./tokens/script')
const Tag = require('./tokens/tag')
const Comment = require('./tokens/comment')
const Variable = require('./tokens/variable')
const Text = require('./tokens/text')
const Str = require('./tokens/string')
const Attr = require('./tokens/attr')
const Logic = require('./tokens/logic')
const LogicNode = require('./tokens/logic-node')
const Func = require('./tokens/function')
const Arr = require('./tokens/array')
const LogicAttr = require('./tokens/logic-attr')
const ParseError = require('./helpers/parse-error')
const appendNode = require('./append-node')

const hasOwnProperty = Function.prototype.call.bind(Object.prototype.hasOwnProperty)
let currentNode

const rules = {
	WHITESPACE: /^(?:()([\s\n\t]+))/,
	ID: /^(?:([\s\n\t]*)([a-zA-Z]([a-zA-Z\-_0-9]+(:[a-zA-Z\-_0-9]+)?)?))/,
	DOCTYPE: /^(?:([\s\n\t]*)(!DOCTYPE))/,
	SCRIPT_LITERAL_OPEN: /^(?:([\s\n\t]*)(<script))/,
	SCRIPT_LITERAL_CLOSE: /^(?:([\s\n\t]*)(<\/\s*script>))/,
	SCRIPT_BODY: /^(((.|\n|\t|\s)*))(?=<\/\s*script>)/,
	STYLE_LITERAL_OPEN: /^(?:([\s\n\t]*)(<style))/,
	STYLE_LITERAL_CLOSE: /^(?:([\s\n\t]*)(<\/\s*style>))/,
	STYLE_BODY: /^(((.|\n|\t|\s)*))(?=<\/\s*style>)/,
	COMMENT_LITERAL: /^(?:([\s\n\t]*)(<!--(.|\n|\s|\t)*?-->))/,
	COLON: /^(?:([\s\n\t]*)(:))/,
	SLASH: /^(?:([\s\n\t]*)(\/))/,
	STRING_DOUBLE_QUOTE_LITERAL: /^(?:([\s\n\t]*)("(\\"|[^"])*?"))/,
	STRING_SINGLE_QUOTE_LITERAL: /^(?:([\s\n\t]*)('(\\'|[^'])*?'))/,
	DOUBLE_EXCLAMATION_MARK: /^(?:([\s\n\t]*)(!!))/,
	EXCLAMATION_MARK: /^(?:([\s\n\t]*)(!))/,
	BRACE_OPEN: /^(?:([\s\n\t]*)(\{))/,
	BRACE_CLOSE: /^(?:([\s\n\t]*)(\}))/,
	CONSTS: /^(?:([\s\n\t]*)(true|false))\b/,
	VAR_NAME: /^(?:([\s\n\t]*)(\$[a-zA-Z]+([a-zA-Z0-9_-]+)?\b))/,
	NUMBER: /^(?:([\s\n\t]*)([0-9]+(\.[0-9]+)?\b))/,
	WORD: /^(?:([\s\n\t]*)([a-zA-Z]+([a-zA-Z0-9_]+)?\b))/,
	MULTIPLICATION: /^(?:([\s\n\t]*)(\*))/,
	REMINDER: /^(?:([\s\n\t]*)(%))/,
	MINUS: /^(?:([\s\n\t]*)(-))/,
	CONCAT: /^(?:([\s\n\t]*)(\+\+))/,
	PLUS: /^(?:([\s\n\t]*)(\+))/,
	BIT_XOR: /^(?:([\s\n\t]*)(\^))/,
	BRAKET_OPEN: /^(?:([\s\n\t]*)(\())/,
	BRAKET_CLOSE: /^(?:([\s\n\t]*)(\)))/,
	SQUARE_OPEN: /^(?:([\s\n\t]*)(\[))/,
	SQUARE_CLOSE: /^(?:([\s\n\t]*)(\]))/,
	NOT_EQUAL: /^(?:([\s\n\t]*)(!=))/,
	LESS_EQUAL: /^(?:([\s\n\t]*)(<=))/,
	MORE_EQUAL: /^(?:([\s\n\t]*)(>=))/,
	EQUAL: /^(?:([\s\n\t]*)(==))/,
	ASSIGN: /^(?:([\s\n\t]*)(=))/,
	BIT_SHIFT_LEFT: /^(?:([\s\n\t]*)(<<))/,
	LT: /^(?:([\s\n\t]*)(<))/,
	BIT_SHIFT_RIGHT: /^(?:([\s\n\t]*)(>>))/,
	GT: /^(?:([\s\n\t]*)(>))/,
	AND: /^(?:([\s\n\t]*)(&&))/,
	OR: /^(?:([\s\n\t]*)(\|\|))/,
	BIT_AND: /^(?:([\s\n\t]*)(&))/,
	BIT_OR: /^(?:([\s\n\t]*)(\|))/,
	BIT_NOT: /^(?:([\s\n\t]*)(~))/,
	DOUBLE_QUESTION_MARK: /^(?:([\s\n\t]*)(\?\?))/,
	QUESTION_MARK: /^(?:([\s\n\t]*)(\?))/,
	COMMA: /^(?:([\s\n\t]*)(,))/,
	ELLIPSIS: /^(?:([\s\n\t]*)(\.\.\.))/,
	TWO_DOTS: /^(?:([\s\n\t]*)(\.\.))/,
	DOT: /^(?:([\s\n\t]*)(\.))/,
	TEXT: /^()([^<{]*)/
}

const tokens = {}
for (const key in rules) {
	if (hasOwnProperty(rules, key)) {
		tokens[key] = key
	}
}

const priorityTable = [
	[tokens.MULTIPLICATION, tokens.SLASH, tokens.REMINDER],
	[tokens.PLUS, tokens.MINUS],
	[tokens.BIT_SHIFT_LEFT, tokens.BIT_SHIFT_RIGHT],
	[tokens.CONCAT],
	[tokens.LT, tokens.LESS_EQUAL, tokens.GT, tokens.MORE_EQUAL],
	[tokens.EQUAL, tokens.NOT_EQUAL],
	[tokens.BIT_AND],
	[tokens.BIT_XOR],
	[tokens.BIT_OR],
	[tokens.AND],
	[tokens.OR],
	[tokens.DOUBLE_QUESTION_MARK, tokens.DOUBLE_EXCLAMATION_MARK],
	[tokens.BRACE_CLOSE, tokens.SQUARE_CLOSE, tokens.COMMA, tokens.BRAKET_CLOSE]
]

const priorities = {}
priorityTable.forEach((row, index) => row.forEach(element => priorities[element] =
	priorityTable.length - index)
)

class Token {
	constructor (input, length, rule, offset, line, column) {
		this.str = input
		this.rule = rule
		this.length = length
		this.offset = offset
		this.line = line
		this.column = column
	}
}

class Lexer {
	constructor (source) {
		this.currentLineNumber = 0
		this.source = source
		this.lines = source.split(/\n/g)
		this.currentLine = source
		this.currentOffset = 0
		this.cachedNextToken = null
		this.lineOffsets = []

		this.preserveLineOffsets()
	}

	preserveLineOffsets() {
		this.lines.forEach(line => this.lineOffsets.push(line.length))
	}

	lookAhead (checkRules, isUseWhitespaces = false, isThrowError = true) {
		let matchedToken

		if (!this.currentLine.length) {
			return new Token('', 0, tokens.EOF, this.currentOffset)
		}

		for (let i = 0; i < checkRules.length; i++) {
			if (matchedToken = this.currentLine.match(rules[checkRules[i]])) {
				if (!isUseWhitespaces || !matchedToken[1].length) {
					const position = this.getPositionByOffset(this.currentOffset)
					return new Token(matchedToken[2], matchedToken[0].length, checkRules[i], this.currentOffset, position.line, position.column)
				}
			}
		}

		if (isThrowError) {
			if (!isUseWhitespaces) {
				const whiteSpaceLength = this.currentLine.match(/^[\s\t]*/)[0].length

				throw new ParseError('Unexpected token. Extected ' + checkRules.join(', '), this.getPositionByOffset(this.currentOffset + whiteSpaceLength))
			} else {
				throw new ParseError('Unexpected token. Extected ' + checkRules.join(', '), this.getPositionByOffset(this.currentOffset))
			}
		}

		return null
	}

	getPositionByOffset(offset) {
		let line = 0
		let found = false

		this.lineOffsets.forEach(lineLength => {
			if (offset - lineLength > 0 && !found) {
				line++
				offset -= lineLength + 1
			} else {
				found = true
			}
		})

		return {line: line + 1, column: offset}
	}

	getNextToken (checkRules, isUseWhitespaces = false) {
		let token

		if (token = this.lookAhead(checkRules, isUseWhitespaces)) {
			this.currentOffset += token.length
			this.currentLine = this.currentLine.substr(token.length)

			return token
		}

		if (!isUseWhitespaces) {
			const whiteSpaceLength = this.currentLine.match(/^[\s\t]*/)[0].length

			throw new ParseError('Unexpected token. Extected ' + checkRules.join(', '), this.getPositionByOffset(this.currentOffset + whiteSpaceLength))
		} else {
			throw new ParseError('Unexpected token. Extected ' + checkRules.join(', '), this.getPositionByOffset(this.currentOffset))
		}
	}

	consume (token) {
		return this.getNextToken([token.rule])
	}
}

function prepareDoubleQuoteString (str) {
	return str.substr(1, str.length - 2).replace(/"/g, '\\"')
}

function prepareSingleQuoteString (str) {
	return str.substr(1, str.length - 2).replace(/\\'/g, '\'')
}

function prepareQuoteString (stringToken) {
	if (stringToken.rule === tokens.STRING_DOUBLE_QUOTE_LITERAL) {
		return prepareDoubleQuoteString(stringToken.str)
	}

	return prepareSingleQuoteString(stringToken.str)
}

function parseAttr (lexer, attrs) {
	const attrName = lexer.getNextToken([
		tokens.ID,
		tokens.STRING_DOUBLE_QUOTE_LITERAL,
		tokens.STRING_SINGLE_QUOTE_LITERAL
	])

	if (attrName.rule === tokens.ID) {
		const assign = lexer.lookAhead([
			tokens.ASSIGN,
			tokens.SLASH,
			tokens.GT,
			tokens.ID,
			tokens.STRING_DOUBLE_QUOTE_LITERAL,
			tokens.STRING_SINGLE_QUOTE_LITERAL
		])
		let value = null

		if (assign.rule === tokens.ASSIGN) {
			lexer.consume(assign)

			value = lexer.getNextToken([
				tokens.STRING_SINGLE_QUOTE_LITERAL,
				tokens.STRING_DOUBLE_QUOTE_LITERAL,
				tokens.BRACE_OPEN
			])

			if (value.rule === tokens.BRACE_OPEN) {
				value = parseLogic(lexer)
				value = new LogicAttr(value, value.line, value.column)
				lexer.getNextToken([tokens.BRACE_CLOSE])
			} else {
				value = new Str(prepareQuoteString(value), value.line, value.column)
			}
		}

		return attrs.push(new Attr(new Str(attrName.str, attrName.line, attrName.column), value))
	}

	attrs.push(new Attr(null, new Str(prepareQuoteString(attrName), attrName.line, attrName.column)))
}

function parseAttrs (lexer) {
	const attrs = []
	let token = lexer.lookAhead([tokens.SLASH, tokens.GT, tokens.WHITESPACE], true)

	while (token.rule === tokens.WHITESPACE) {
		lexer.getNextToken([tokens.WHITESPACE], true)
		token = lexer.lookAhead([
			tokens.SLASH,
			tokens.GT,
			tokens.ID,
			tokens.STRING_DOUBLE_QUOTE_LITERAL,
			tokens.STRING_SINGLE_QUOTE_LITERAL
		])

		if (~[tokens.ID, tokens.STRING_DOUBLE_QUOTE_LITERAL, tokens.STRING_SINGLE_QUOTE_LITERAL].indexOf(token.rule)) {
			parseAttr(lexer, attrs)
		}

		token = lexer.lookAhead([tokens.SLASH, tokens.GT, tokens.ID, tokens.WHITESPACE], true)
	}

	if (token.rule === tokens.GT || token.rule === tokens.SLASH) {
		return attrs
	}

	return attrs
}

function parseTag (lexer) {
	lexer.getNextToken([tokens.LT])
	let token = lexer.getNextToken([tokens.DOCTYPE, tokens.SLASH, tokens.ID], true)
	let isClosingTag = false

	if (token.rule === tokens.SLASH) {
		isClosingTag = true

		token = lexer.getNextToken([tokens.ID], true)
	}

	const tagname = token.str

	if (isClosingTag) {
		if (tagname !== currentNode.name) {
			throw new ParseError(`Tag doesn't match. Expected </${currentNode.name}>, got </${tagname}>`, lexer.getPositionByOffset(token.offset))
		}

		lexer.getNextToken([tokens.GT])

		return currentNode = currentNode.parentNode
	}

	const attrs = parseAttrs(lexer)
	let isSingle = false

	if (token.rule === tokens.DOCTYPE) {
		isSingle = true
	}

	token = lexer.getNextToken([tokens.SLASH, tokens.GT])

	if (token.rule === tokens.SLASH) {
		isSingle = true

		lexer.getNextToken([tokens.GT])
	}

	const tag = new Tag(tagname, attrs, isSingle, token.line, token.column)
	appendNode(currentNode, tag)

	if (!tag.isSingle) {
		currentNode = tag
	}
}

function parseText (lexer) {
	const token = lexer.getNextToken([tokens.TEXT])

	appendNode(currentNode, new Text(token.str, token.line, token.column))
}

const variableSeparators = [tokens.ELLIPSIS, tokens.TWO_DOTS, tokens.DOT, tokens.SQUARE_OPEN]

function parseVariable (lexer) {
	const variableToken = lexer.getNextToken([tokens.VAR_NAME])
	const variable = new Variable(variableToken.str.substr(1), variableToken.line, variableToken.column)
	let token
	let expr

	while (token = lexer.lookAhead(variableSeparators, false, false)) {
		if (token.rule === tokens.ELLIPSIS || token.rule === tokens.TWO_DOTS) {
			break
		}

		lexer.consume(token)

		switch (token.rule) {
			case tokens.DOT:
				expr = lexer.getNextToken([tokens.WORD])
				variable.addKey(new Logic('str', expr.str, expr.line, expr.column))

				break
			case tokens.SQUARE_OPEN:
				expr = parseLogic(lexer)
				variable.addKey(expr)
				lexer.getNextToken([tokens.SQUARE_CLOSE])

				break
		}
	}

	const isIssetToken = lexer.lookAhead([tokens.DOUBLE_QUESTION_MARK, tokens.QUESTION_MARK], false, false)

	if (isIssetToken && isIssetToken.rule === 'QUESTION_MARK') {
		lexer.consume(isIssetToken)

		return new Logic('isset', variable, isIssetToken.line, isIssetToken.column)
	}

	return variable
}

function parseFunction(lexer) {
	const funcName = lexer.getNextToken([tokens.WORD])
	const func = new Func(funcName.str)
	let separator
	lexer.getNextToken([tokens.BRAKET_OPEN])

	if (!lexer.lookAhead([tokens.BRAKET_CLOSE], false, false)) {
		func.addAttr(parseLogic(lexer))
	}

	while (separator = lexer.lookAhead([tokens.COMMA], false, false)) {
		lexer.consume(separator)
		func.addAttr(parseLogic(lexer))
	}

	lexer.getNextToken([tokens.BRAKET_CLOSE])

	return func
}

function parseArr (lexer) {
	lexer.getNextToken([tokens.SQUARE_OPEN])
	const items = []

	let value
	let key
	let delimiter = lexer.lookAhead([tokens.SQUARE_CLOSE], false, false)
	let expr

	if (delimiter) {
		lexer.consume(delimiter)
		return new Arr(items)
	}

	while (true) { // eslint-disable-line
		value = parseLogic(lexer)
		key = null
		delimiter = lexer.lookAhead([
			tokens.COMMA,
			tokens.COLON,
			tokens.SQUARE_CLOSE,
			tokens.ELLIPSIS,
			tokens.TWO_DOTS
		])

		if (delimiter.rule === tokens.TWO_DOTS) {
			lexer.consume(delimiter)
			expr = parseLogic(lexer)
			lexer.getNextToken([tokens.SQUARE_CLOSE])

			return new Arr('close', value, expr)
		}

		if (delimiter.rule === tokens.ELLIPSIS) {
			lexer.consume(delimiter)
			expr = parseLogic(lexer)
			lexer.getNextToken([tokens.SQUARE_CLOSE])

			return new Arr('open', value, expr)
		}

		if (delimiter.rule === tokens.COLON) {
			lexer.consume(delimiter)

			if (value.type !== 'num' && value.type !== 'str') {
				throw new ParseError('Map key could be a number or a string', value)
			}

			key = value
			value = parseLogic(lexer)
		}

		items.push({key, value})

		delimiter = lexer.getNextToken([tokens.SQUARE_CLOSE, tokens.COMMA])

		if (delimiter.rule === tokens.SQUARE_CLOSE) {
			return new Arr(items)
		}
	}
}

function parseExpr (lexer) {
	const token = lexer.lookAhead([
		tokens.CONSTS,
		tokens.VAR_NAME,
		tokens.WORD,
		tokens.NUMBER,
		tokens.MINUS,
		tokens.PLUS,
		tokens.EXCLAMATION_MARK,
		tokens.BIT_NOT,
		tokens.STRING_DOUBLE_QUOTE_LITERAL,
		tokens.STRING_SINGLE_QUOTE_LITERAL,
		tokens.BRAKET_OPEN,
		tokens.SQUARE_OPEN
	])
	let expr

	switch (token.rule) {
		case tokens.MINUS:
			lexer.consume(token)

			return new Logic('uminus', parseExpr(lexer), token.line, token.column)
		case tokens.PLUS:
			lexer.consume(token)

			return new Logic('uplus', parseExpr(lexer), token.line, token.column)
		case tokens.EXCLAMATION_MARK:
			lexer.consume(token)

			return new Logic('not', parseExpr(lexer), token.line, token.column)
		case tokens.BIT_NOT:
			lexer.consume(token)

			return new Logic('bitnot', parseExpr(lexer), token.line, token.column)
		case tokens.NUMBER:
			lexer.consume(token)

			return new Logic('num', token.str, token.line, token.column)
		case tokens.VAR_NAME:
			return parseVariable(lexer)

		case tokens.STRING_SINGLE_QUOTE_LITERAL:
		case tokens.STRING_DOUBLE_QUOTE_LITERAL:
			lexer.consume(token)

			return new Logic('str', prepareQuoteString(token), token.line, token.column)
		case tokens.WORD:
			return parseFunction(lexer)

		case tokens.CONSTS:
			lexer.consume(token)

			return new Logic('const', token.str, token.line, token.column)
		case tokens.BRAKET_OPEN:
			lexer.consume(token)
			expr = parseLogic(lexer)
			lexer.getNextToken([tokens.BRAKET_CLOSE])

			return new Logic('brack', expr, token.line, token.column)
		case tokens.SQUARE_OPEN:
			return parseArr(lexer)
	}
}

const operationTokens = [
	tokens.MULTIPLICATION,
	tokens.SLASH,
	tokens.REMINDER,
	tokens.CONCAT,
	tokens.PLUS,
	tokens.MINUS,
	tokens.BIT_SHIFT_LEFT,
	tokens.BIT_SHIFT_RIGHT,
	tokens.LESS_EQUAL,
	tokens.LT,
	tokens.MORE_EQUAL,
	tokens.GT,
	tokens.EQUAL,
	tokens.NOT_EQUAL,
	tokens.AND,
	tokens.OR,
	tokens.BIT_AND,
	tokens.BIT_XOR,
	tokens.BIT_OR,
	tokens.DOUBLE_QUESTION_MARK
]

function parseLogic (lexer, priority = 0) {
	let expr = parseExpr(lexer)
	let operation
	let left

	while (operation = lexer.lookAhead(operationTokens, false, false)) {
		const operationPriority = priorities[operation.rule]

		if (operationPriority < priority) {
			return expr
		}

		switch (operation.rule) {
			case tokens.MULTIPLICATION:
				lexer.consume(operation)
				expr = new Logic('mult', [expr, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
			case tokens.SLASH:
				lexer.consume(operation)
				expr = new Logic('divis', [expr, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
			case tokens.REMINDER:
				lexer.consume(operation)
				expr = new Logic('mod', [expr, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
			case tokens.CONCAT:
				lexer.consume(operation)
				expr = new Logic('concat', [expr, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
			case tokens.PLUS:
				lexer.consume(operation)
				expr = new Logic('plus', [expr, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
			case tokens.MINUS:
				lexer.consume(operation)
				expr = new Logic('minus', [expr, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
			case tokens.BIT_SHIFT_LEFT:
				lexer.consume(operation)
				expr = new Logic('leftshift', [expr, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
			case tokens.BIT_SHIFT_RIGHT:
				lexer.consume(operation)
				expr = new Logic('rightshift', [expr, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
			case tokens.LT:
				lexer.consume(operation)
				expr = new Logic('lt', [expr, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
			case tokens.LESS_EQUAL:
				lexer.consume(operation)
				expr = new Logic('ltequal', [expr, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
			case tokens.GT:
				lexer.consume(operation)
				expr = new Logic('gt', [expr, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
			case tokens.MORE_EQUAL:
				lexer.consume(operation)
				expr = new Logic('gtequal', [expr, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
			case tokens.EQUAL:
				lexer.consume(operation)
				expr = new Logic('equal', [expr, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
			case tokens.NOT_EQUAL:
				lexer.consume(operation)
				expr = new Logic('notequal', [expr, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
			case tokens.BIT_AND:
				lexer.consume(operation)
				expr = new Logic('bitand', [expr, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
			case tokens.BIT_XOR:
				lexer.consume(operation)
				expr = new Logic('bitxor', [expr, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
			case tokens.BIT_OR:
				lexer.consume(operation)
				expr = new Logic('bitor', [expr, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
			case tokens.AND:
				lexer.consume(operation)
				expr = new Logic('and', [expr, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
			case tokens.OR:
				lexer.consume(operation)
				expr = new Logic('or', [expr, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
			case tokens.DOUBLE_QUESTION_MARK:
				lexer.consume(operation)
				left = parseLogic(lexer, operationPriority)
				lexer.getNextToken([tokens.DOUBLE_EXCLAMATION_MARK])
				expr = new Logic('ternary', [expr, left, parseLogic(lexer, operationPriority)], operation.line, operation.column)
				break
		}
	}

	return expr
}

function parseLogicNode (lexer) {
	lexer.getNextToken([tokens.BRACE_OPEN])

	const logic = parseLogic(lexer)

	appendNode(currentNode, new LogicNode(logic, logic.line, logic.column))

	lexer.getNextToken([tokens.BRACE_CLOSE])
}

function parseComment (lexer) {
	const commentToken = lexer.getNextToken([tokens.COMMENT_LITERAL])
	const commentStr = commentToken.str.substr(4, commentToken.str.length - 7)
	const comment = new Comment(commentStr, commentToken.line, commentToken.column)

	appendNode(currentNode, comment)
}

function parseScript (lexer) {
	const scriptToken = lexer.getNextToken([tokens.SCRIPT_LITERAL_OPEN])
	const attrs = parseAttrs(lexer)
	lexer.getNextToken([tokens.GT])
	const scriptBody = lexer.getNextToken([tokens.SCRIPT_BODY])
	lexer.getNextToken([tokens.SCRIPT_LITERAL_CLOSE])
	const script = new Script(attrs, scriptBody, scriptToken.line, scriptToken.column)

	appendNode(currentNode, script)
}

function parseStyle (lexer) {
	const styleToken = lexer.getNextToken([tokens.STYLE_LITERAL_OPEN])
	const attrs = parseAttrs(lexer)
	lexer.getNextToken([tokens.GT])
	const styleBody = lexer.getNextToken([tokens.STYLE_BODY])
	lexer.getNextToken([tokens.STYLE_LITERAL_CLOSE])
	const style = new Style(attrs, styleBody, styleToken.line, styleToken.column)

	appendNode(currentNode, style)
}

function nodes (lexer) {
	let token

	while (true) { // eslint-disable-line
		token = lexer.lookAhead([
			tokens.STYLE_LITERAL_OPEN,
			tokens.SCRIPT_LITERAL_OPEN,
			tokens.COMMENT_LITERAL,
			tokens.LT,
			tokens.BRACE_OPEN,
			tokens.TEXT
		], true)

		switch (token.rule) {
			case tokens.STYLE_LITERAL_OPEN:
				parseStyle(lexer)
				break
			case tokens.SCRIPT_LITERAL_OPEN:
				parseScript(lexer)
				break
			case tokens.COMMENT_LITERAL:
				parseComment(lexer)
				break
			case tokens.BRACE_OPEN:
				parseLogicNode(lexer)
				break
			case tokens.LT:
				parseTag(lexer)
				break
			case tokens.TEXT:
				parseText(lexer)
				break
			case tokens.EOF:
				return
		}
	}
}

function parser (source) {
	const lexer = new Lexer(source)

	currentNode = new Tag('root', [], null, 1, 0)

	nodes(lexer)

	return currentNode
}

module.exports = parser
