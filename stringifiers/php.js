var consts = ['true', 'false']

function expression (tree) {
  var str = ''

  if (typeof tree === 'string') return tree

  switch (tree.type) {
    case 'var':
      str += (~consts.indexOf(tree.value) ? '' : '$') + tree.value + tree.keys.map(function (key) {
        return '[' + expression(key) + ']'
      }).join('')

      return str
    case 'num':
      str += tree.value

      return str
    case 'plus':
      str += expression(tree.value[0]) + ' + ' + expression(tree.value[1])

      return str
    case 'minus':
      str += expression(tree.value[0]) + ' - ' + expression(tree.value[1])

      return str
    case 'mult':
      str += expression(tree.value[0]) + ' * ' + expression(tree.value[1])

      return str
    case 'divis':
      str += expression(tree.value[0]) + ' / ' + expression(tree.value[1])

      return str
    case 'or':
      str += expression(tree.value[0]) + ' || ' + expression(tree.value[1])

      return str
    case 'and':
      str += expression(tree.value[0]) + ' && ' + expression(tree.value[1])

      return str
    case 'bitor':
      str += expression(tree.value[0]) + ' | ' + expression(tree.value[1])

      return str
    case 'bitand':
      str += expression(tree.value[0]) + ' & ' + expression(tree.value[1])

      return str
    case 'notequal':
      str += expression(tree.value[0]) + ' != ' + expression(tree.value[1])

      return str
    case 'equal':
      str += expression(tree.value[0]) + ' == ' + expression(tree.value[1])

      return str
    case 'gtequal':
      str += expression(tree.value[0]) + ' >= ' + expression(tree.value[1])

      return str
    case 'gt':
      str += expression(tree.value[0]) + ' > ' + expression(tree.value[1])

      return str
    case 'lt':
      str += expression(tree.value[0]) + ' < ' + expression(tree.value[1])

      return str
    case 'ltequal':
      str += expression(tree.value[0]) + ' <= ' + expression(tree.value[1])

      return str
    case 'isset':
      str += 'isset(' + expression(tree.value) + ')'

      return str
    case 'not':
      str += '!' + expression(tree.value)

      return str
    case 'brack':
      str += '(' + expression(tree.value) + ')'

      return str
    case 'uminus':
      str += '-' + expression(tree.value)

      return str
    case 'func':
      str +=
        (tree.value.type === 'var' && !tree.value.keys.length ? tree.value.value : expression(tree.value))
      str += '(' + tree.attrs.map(function (attr) {

        return expression(attr)
      }).join(', ') + ')'

      return str

    case 'concat':
      return tree.value.map(function (item) {
        return expression(item)
      }).join(' . ')
  }

  return str
}

function switchNode (node) {
  var result = ''

  switch (node.type) {
    case 'open_tag':
      result += '<' + node.value + reduce(node.attrs.childs) + '>'
      result += reduce(node.childs)
      result += '</' + node.value + '>'

      return result
    case 'single_tag':
      result += '<' + node.value + reduce(node.attrs.childs) + (node.value === '!DOCTYPE' ? '' : ' /') + '>'

      return result
    case 'comment':
      result += '<!--' + node.value + '-->'

      return result
    case 'assign':
      result += '<?php ' + expression(node.value) + ' = ' + expression(node.expr) + '; ?>'

      return result
    case 'if':
      result += '<?php if (' + expression(node.value) + ') { ?>'
      result += reduce(node.childs)

      return result
    case 'elseif':
      result += '<?php } elseif (' + expression(node.value) + ') { ?>'
      result += reduce(node.childs)

      return result
    case 'else':
      result += '<?php } else { ?>'
      result += reduce(node.childs)

      return result
    case 'endif':
      result += '<?php } ?>'

      return result
    case 'for':
      result += '<?php foreach ('

      if (node.value.length === 2) {
        result += expression(node.value[1]) + ' as ' + expression(node.value[0])
      } else if (node.value.length === 3) {
        result += expression(node.value[2]) + ' as ' + expression(node.value[0]) +
          ' => ' + expression(node.value[1])
      }

      result += ') { ?>'
      result += reduce(node.childs)

      result += '<?php } ?>'

      return result
    case 'expr':
      if (node.value.type === 'isset') {
        result += '<?php if (isset(' + expression(node.value.value) + ')) echo ' + expression(node.value.value) + '; ?>'
      } else {
        result += '<?php echo ' + expression(node.value) + '; ?>'
      }

      return result
    case 'text':
      result += node.value

      return result
    case 'param':
      if (node.value) {
        if (node.value.length) {
          result += reduce(node.value)
        }

        return ' ' + node.name + (result.length ? '="' + result + '"' : '')
      }

      if (node.string) {
        if (node.string.length) {
          result += reduce(node.string)
        }

        return ' ' + (result.length ? '"' + result + '"' : '')
      }
  }

  return ''
}

function reduce (tree) {
  var result = ''

  tree.forEach(function (node) {
    result += switchNode(node)
  })

  return result
}

module.exports = {
  ext: 'php',
  stringify: function (tree) {
    return reduce(tree.childs)
  }
}
