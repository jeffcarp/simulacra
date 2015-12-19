/*!
 * Simulacra.js
 * Version 0.4.0
 * MIT License
 * https://github.com/0x8890/simulacra
 */
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

var processNodes = require('./process_nodes')

module.exports = defineProperties


/**
 * Define getters & setters. This function does most of the heavy lifting.
 *
 * @param {Object} obj
 * @param {Object} def
 * @param {Node} parentNode
 */
function defineProperties (obj, def, parentNode) {
  var store, properties, i, j

  if (typeof obj !== 'object')
    throw TypeError(
      'Invalid type for "' + obj + '", object expected.')

  // Using the closure here to store private object.
  store = {}

  properties = Object.keys(def)
  for (i = 0, j = properties.length; i < j; i++) define(properties[i])

  function define (key) {
    var initialValue = obj[key]
    var branch = def[key]
    var mutator = branch.mutator
    var definition = branch.definition

    // Keeping state in this closure.
    var activeNodes = []
    var previousValues = []

    Object.defineProperty(obj, key, {
      get: getter, set: setter, enumerable: true
    })

    // For initialization, call this once.
    setter(initialValue)

    function getter () {
      return store[key]
    }

    function setter (x) {
      var i, j

      // Special case for binding same node as parent.
      if (branch.__isBoundToParent) {
        if (mutator) mutator(parentNode, x, store[key])
        else if (definition) defineProperties(x, definition, parentNode)
        store[key] = x
        return null
      }

      store[key] = x

      if (!Array.isArray(x)) x = [ x ]

      // Assign custom mutator methods on the array instance.
      else if (!x.__hasMutators) {
        x.__hasMutators = true

        // These mutators preserve length.
        x.reverse = reverse
        x.sort = sort
        x.copyWithin = copyWithin
        x.fill = fill

        // These mutators may alter length.
        x.pop = pop
        x.push = push
        x.shift = shift
        x.unshift = unshift
        x.splice = splice

        // Handle array index assignment.
        for (i = 0, j = x.length; i < j; i++) defineIndex(x, i)
      }

      // Handle rendering to the DOM.
      for (i = 0, j = Math.max(previousValues.length, x.length); i < j; i++)
        checkValue(x, i)

      // Reset length to current values, implicitly deleting indices from
      // `previousValues` and `activeNodes` and allowing for garbage
      // collection.
      previousValues.length = activeNodes.length = x.length

      return store[key]
    }

    function checkValue (array, i) {
      var value = array[i]
      var previousValue = previousValues[i]

      if (previousValue === value) return

      addNode(value, previousValue, i)
    }

    function defineIndex (array, i) {
      var value = array[i]

      Object.defineProperty(array, i, {
        get: function () { return value },
        set: function (x) { value = x; checkValue(array, i) },
        enumerable: true, configurable: true
      })
    }

    function removeNode (value, previousValue, i) {
      var activeNode = activeNodes[i]

      // Cast previous value to null if undefined.
      if (previousValue === void 0) previousValue = null

      delete previousValues[i]

      if (activeNode) {
        if (mutator) mutator(activeNode, null, previousValue, i)
        branch.marker.parentNode.removeChild(activeNode)
        delete activeNodes[i]
      }
    }

    function addNode (value, previousValue, i) {
      var j, k, node, nextNode, activeNode = activeNodes[i]

      // Cast previous value to null if undefined.
      if (previousValue === void 0) previousValue = null

      // If value is undefined or null, just remove it.
      if (value == null) return removeNode(null, previousValue, i)

      previousValues[i] = value

      if (mutator) {
        if (activeNode) {
          mutator(activeNode, value, previousValue, i)
          return null
        }

        node = branch.node.cloneNode(true)
        mutator(node, value, previousValue, i)
      }

      else if (definition) {
        if (activeNode) removeNode(value, previousValue, i)
        node = processNodes(branch.node.cloneNode(true), definition, i)
        defineProperties(value, definition, node)
      }

      // Find the next node.
      for (j = i + 1, k = activeNodes.length; j < k; j++)
        if (activeNodes[j]) {
          nextNode = activeNodes[j]
          break
        }

      activeNodes[i] = branch.marker.parentNode.insertBefore(
        node, nextNode || branch.marker)
    }


    // =======================================
    // Below are array mutator methods.
    // They have to exist within this closure.
    // =======================================

    function reverse () {
      return setter(Array.prototype.reverse.call(this))
    }

    function sort (fn) {
      return setter(Array.prototype.sort.call(this, fn))
    }

    function fill (a, b, c) {
      return setter(Array.prototype.fill.call(this, a, b, c))
    }

    function copyWithin (a, b, c) {
      return setter(Array.prototype.copyWithin.call(this, a, b, c))
    }

    function pop () {
      var i = this.length - 1
      var previousValue = previousValues[i]
      var value = Array.prototype.pop.call(this)

      removeNode(null, previousValue, i)
      previousValues.length = activeNodes.length = this.length

      return value
    }

    function push () {
      var i = this.length, j
      var value = Array.prototype.push.apply(this, arguments)

      for (j = i + arguments.length; i < j; i++) {
        addNode(this[i], null, i)
        defineIndex(this, i)
      }

      return value
    }

    function shift () {
      removeNode(null, previousValues[0], 0)

      Array.prototype.shift.call(previousValues)
      Array.prototype.shift.call(activeNodes)
      return Array.prototype.shift.call(this)
    }

    function unshift () {
      var i = this.length, j, value

      Array.prototype.unshift.apply(previousValues, arguments)
      Array.prototype.unshift.apply(activeNodes, Array(arguments.length))
      value = Array.prototype.unshift.apply(this, arguments)

      for (j = arguments.length; j--;) addNode(arguments[j], null, j)
      for (j = i + arguments.length; i < j; i++) defineIndex(this, i)

      return value
    }

    function splice (start, count) {
      var args = Array.prototype.slice.call(arguments, 2)
      var i, j, k = args.length - count, value

      for (i = start, j = start + count; i < j; i++)
        removeNode(null, previousValues[i], i)

      Array.prototype.splice.apply(previousValues, arguments)
      Array.prototype.splice.apply(activeNodes,
        [ start, count ].concat(Array(args.length)))
      value = Array.prototype.splice.apply(this, arguments)

      for (i = start + args.length - 1, j = start; i >= j; i--)
        addNode(args[(i - start) | 0], null, i)

      if (k < 0)
        previousValues.length = activeNodes.length = this.length

      else if (k > 0)
        for (i = this.length - k, j = this.length; i < j; i++)
          defineIndex(this, i)

      return value
    }
  }
}

},{"./process_nodes":4}],2:[function(require,module,exports){
'use strict'

module.exports = findNodes


/**
 * Find matching DOM nodes on cloned nodes.
 *
 * @param {Node} node
 * @param {Object} definition
 * @return {WeakMap}
 */
function findNodes (node, definition) {
  var treeWalker = document.createTreeWalker(
    node, NodeFilter.SHOW_ELEMENT)
  var keys = Object.keys(definition)
  var map = new WeakMap()
  var nodes = []
  var i, j

  for (i = 0, j = keys.length; i < j; i++)
    nodes[nodes.length] = definition[keys[i]].node

  while (treeWalker.nextNode() && j)
    for (i = 0, j = nodes.length; i < j; i++)
      if (treeWalker.currentNode.isEqualNode(nodes[i])) {
        map.set(nodes[i], treeWalker.currentNode)
        nodes.splice(i, 1)
      }

  return map
}

},{}],3:[function(require,module,exports){
'use strict'

var processNodes = require('./process_nodes')
var defineProperties = require('./define_properties')

module.exports = simulacra


/**
 * Dynamic dispatch function.
 *
 * @param {Node|Object}
 * @param {Function|Object}
 */
function simulacra (a, b) {
  if (a instanceof Node) return define(a, b)
  if (typeof a === 'object') return bind(a, b)

  throw new TypeError('First argument must be either ' +
    'a DOM Node or an Object.')
}


/**
 * Define a binding.
 *
 * @param {String|Node}
 * @param {Function|Object}
 */
function define (node, def) {
  // Memoize the selected node.
  var obj = { node: node }

  // Although WeakSet would work here, WeakMap has better browser support.
  var seen = new WeakMap()

  var i, j, keys, branch, boundNode

  if (typeof def === 'function')
    obj.mutator = def

  else if (typeof def === 'object') {
    obj.definition = def

    for (i = 0, keys = Object.keys(def), j = keys.length; i < j; i++) {
      branch = def[keys[i]]
      boundNode = branch.node

      // Special case for binding to parent node.
      if (node === boundNode) {
        branch.__isBoundToParent = true
        if (branch.mutator && branch.mutator.__isDefault)
          branch.mutator = noop(keys[i])
        continue
      }

      if (!node.contains(boundNode))
        throw new Error('The bound DOM Node must be either ' +
          'contained in or equal to its parent binding.')

      if (!seen.get(boundNode)) seen.set(boundNode, true)
      else throw new Error('Can not bind multiple keys to the same child ' +
        'DOM Node. Collision found on key "' + keys[i] + '".')
    }
  }

  else if (def === void 0)
    if (node.nodeName === 'INPUT' || node.nodeName === 'SELECT')
      if (node.type === 'checkbox' || node.type === 'radio')
        obj.mutator = replaceChecked
      else obj.mutator = replaceValue
    else obj.mutator = replaceText

  else throw new TypeError('Second argument must be either ' +
    'a function or an object.')

  return obj
}


/**
 * Bind an object to a Node.
 *
 * @param {Object}
 * @param {Object}
 * @return {Node}
 */
function bind (obj, def) {
  var node

  if (Array.isArray(obj))
    throw new TypeError('First argument must be a singular object.')

  if (!(def.node instanceof Node))
    throw new TypeError('Top-level binding must have a Node.')

  if (typeof def.definition !== 'object')
    throw new TypeError('Top-level binding must be an object.')

  node = processNodes(def.node.cloneNode(true), def.definition)
  defineProperties(obj, def.definition, node)

  return node
}


// Default DOM mutation functions.
function replaceText (node, value) { node.textContent = value }
function replaceValue (node, value) { node.value = value }
function replaceChecked (node, value) { node.checked = value }

replaceText.__isDefault = true
replaceValue.__isDefault = true
replaceChecked.__isDefault = true

function noop (key) {
  return function () {
    console.warn( // eslint-disable-line
      'Undefined mutator function for key "' + key + '".')
  }
}

},{"./define_properties":1,"./process_nodes":4}],4:[function(require,module,exports){
'use strict'

var findNodes = require('./find_nodes')

module.exports = processNodes


/**
 * Internal function to remove bound nodes and replace them with markers.
 *
 * @param {Node}
 * @param {Object}
 * @return {Node}
 */
function processNodes (node, def) {
  var keys = Object.keys(def)
  var map = findNodes(node, def)
  var i, j, branch, key, mirrorNode, marker, parent

  for (i = 0, j = keys.length; i < j; i++) {
    key = keys[i]
    branch = def[key]
    if (branch.__isBoundToParent) continue
    mirrorNode = map.get(branch.node)
    parent = mirrorNode.parentNode
    marker = document.createTextNode('')
    branch.marker = parent.insertBefore(marker, mirrorNode)
    parent.removeChild(mirrorNode)
  }

  return node
}

},{"./find_nodes":2}],5:[function(require,module,exports){
'use strict'

window.simulacra = require('../lib')

},{"../lib":3}]},{},[5]);
