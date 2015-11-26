/*!
 * Simulacra.js
 * Version 0.2.2
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
  // Using the closure here to store private object.
  var store = {}

  var properties = Object.keys(def)
  var i, j, property

  for (i = 0, j = properties.length; i < j; i++) {
    property = properties[i]
    store[property] = obj[property]
    define(property)
  }

  function define (key) {
    var branch = def[key]
    var mount = branch.mount
    var unmount = branch.unmount
    var definition = branch.definition

    // Keeping state in this closure.
    var activeNodes = []
    var previousValues = []

    Object.defineProperty(obj, key, {
      get: getter, set: setter, enumerable: true
    })

    // For initialization, call this once.
    setter(store[key])

    function getter () {
      return store[key]
    }

    function setter (x) {
      var i, j

      // Special case for binding same node as parent.
      if (branch.isBoundToParent) {
        if (mount) mount(parentNode, x, store[key])
        else if (definition) defineProperties(x, definition, parentNode)
        store[key] = x
        return
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

      removeNode(value, previousValue, i)
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

      delete previousValues[i]

      if (activeNode) {
        if (unmount) unmount(activeNode, value, previousValue, i)
        branch.marker.parentNode.removeChild(activeNode)
        delete activeNodes[i]
      }
    }

    function addNode (value, previousValue, i) {
      var j, k, node, nextNode

      if (value === null || value === void 0) {
        delete previousValues[i]
        delete activeNodes[i]
        return
      }

      previousValues[i] = value

      if (mount) {
        node = branch.node.cloneNode(true)
        node = mount(node, value, previousValue, i) || node
      }

      else if (definition) {
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
        addNode(args[i - start], null, i)

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
 * @param {Function}
 */
function simulacra (a, b, c) {
  if (a instanceof Node) return define(a, b, c)
  if (typeof a === 'object') return bind(a, b)

  throw new TypeError('First argument must be either ' +
    'a DOM Node or an Object.')
}


/**
 * Define a binding.
 *
 * @param {String|Node}
 * @param {Function|Object}
 * @param {Function}
 */
function define (node, def, unmount) {
  // Memoize the selected node.
  var obj = { node: node }

  // Although WeakSet would work here, WeakMap has better browser support.
  var seen = new WeakMap()

  var i, j, keys, value

  if (typeof def === 'function') {
    obj.mount = def
    if (typeof unmount === 'function') obj.unmount = unmount
  }

  else if (typeof def === 'object') {
    obj.definition = def

    for (i = 0, keys = Object.keys(def), j = keys.length; i < j; i++) {
      value = def[keys[i]].node

      // Special case for binding to parent node.
      if (node === value) {
        def[keys[i]].isBoundToParent = true
        continue
      }

      if (!node.contains(value))
        throw new Error('The bound DOM Node must be either ' +
          'contained in or equal to its parent binding.')

      if (!seen.get(value)) seen.set(value, true)
      else throw new Error('Can not bind multiple keys to the same child ' +
        'DOM Node. Collision found on key "' + keys[i] + '".')
    }
  }

  else if (def === void 0)
    if (node.nodeName === 'INPUT' || node.nodeName === 'SELECT')
      if (node.type === 'checkbox' || node.type === 'radio')
        obj.mount = replaceChecked
      else obj.mount = replaceValue
    else obj.mount = replaceText

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


function replaceText (node, value) {
  node.textContent = value
}


function replaceValue (node, value) {
  node.value = value
}


function replaceChecked (node, value) {
  node.checked = value
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
    if (branch.isBoundToParent) continue
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
