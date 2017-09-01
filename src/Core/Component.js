/**
 * @constructor
 */
function Component (props, context) {
	this.refs = null
	this.state = null
	this.props = props
	this.context = context
	this[SymbolElement] = null
}
/**
 * @type {Object}
 */
var ComponentPrototype = {
	forceUpdate: {value: forceUpdate}, 
	setState: {value: setState}
}

createComponent(Component.prototype)

/**
 * @param {Object} prototype
 * @return {Object}
 */
function createComponent (prototype) {
	defineProperty(defineProperties(prototype, ComponentPrototype), SymbolComponent, {value: SymbolComponent})

	if (!prototype.hasOwnProperty(LifecycleRender))
		defineProperty(prototype, LifecycleRender, {value: noop, writable: true})
}

/**
 * @param {(Object|function)} state
 * @param {function?} callback
 */
function setState (state, callback) {
	enqueueState(this[SymbolElement], this, state, callback)
}

/**
 * @param {function} callback
 */
function forceUpdate (callback) {
	enqueueUpdate(this[SymbolElement], this, callback, ComponentForce)
}

/**
 * @param {Element} element
 * @return {number}
 */
function componentMount (element) {
	var owner = element.type
	var prototype = owner.prototype
	var children
	var instance

	if (prototype && prototype.render) {
		if (prototype[SymbolComponent] !== SymbolComponent)
			createComponent(prototype)

		instance = owner = getChildInstance(element)
	} else {
		instance = new Component()
		instance.render = owner
	}

	element.owner = owner
	element.instance = instance
	
	instance[SymbolElement] = element
	instance.refs = {}
	instance.props = element.props
	instance.context = element.context = element.context || {}

	if (owner[LifecycleInitialState])
		instance.state = getInitialState(element, instance, lifecycleData(element, LifecycleInitialState))
	else if (!instance.state)
		instance.state = {}
	
	children = getChildElement(element)
	children.context = element.context

	element.children = children
}

/**
 * @param {Element} element
 * @param {Element} snapshot
 * @param {number} signature
 */
function componentUpdate (element, snapshot, signature) {
	if (element.work < WorkSync)
		return

	element.work = WorkTask

	var instance = element.instance
	var owner = element.owner
	var nextContext = instance.context
	var prevProps = element.props
	var nextProps = snapshot.props
	var prevState = instance.state
	var nextState = signature === ComponentUpdate ? assign({}, prevState, element.state) : prevState

	if (owner[LifecycleChildContext])
		merge(element.context, getChildContext(element))

	switch (signature) {
		case ComponentForce:
			break
		case ComponentReconcile:
			if (owner[LifecycleWillReceiveProps]) {
				lifecycleUpdate(element, LifecycleWillReceiveProps, nextProps, nextContext)
			}
		case ComponentUpdate:
			if (owner[LifecycleShouldUpdate])
				if (lifecycleUpdate(element, LifecycleShouldUpdate, nextProps, nextState, nextContext) === false)
					return void (element.work = WorkSync)
	}

	if (owner[LifecycleWillUpdate])
		lifecycleUpdate(element, LifecycleWillUpdate, nextProps, nextState, nextContext)

	instance.state = nextState
	instance.props = nextProps

	reconcileElement(element.children, getChildElement(element))

	if (owner[LifecycleDidUpdate])
		lifecycleUpdate(element, LifecycleDidUpdate, prevProps, prevState, nextContext)

	if (element.ref !== snapshot.ref)
		commitRef(element, snapshot.ref, RefReplace)

	element.work = WorkSync
}

/**
 * @param {Element} element
 * @param {List} children
 * @param {Element} parent
 * @param {number} signature
 */
function componentUnmount (element, children, parent, signature) {
	if (element.owner[LifecycleWillUnmount])
		if (element.state = lifecycleMount(element, LifecycleWillUnmount))
			if (element.state.constructor === Promise)
				return !!element.state.then(function () {
					element.state = void commitUnmount(children, parent, signature)
				})

	commitUnmount(children, parent, signature)
}

/**
 * @param {(Component|Node)?} value
 * @param {*} key
 * @param {Element} element
 */
function componentRef (value, key, element) {
	if (this.refs) {
		if (key !== element.ref)
			delete this.refs[element.ref]

		this.refs[key] = value
	}
}

/**
 * @param {Element} Element
 * @param {Component} instance
 * @param {(Object|function)} state
 * @param {function?} callback
 */
function enqueueState (element, instance, state, callback) {
	if (state)
		switch (state.constructor) {
			case Promise:
				return enqueuePending(element, instance, state, callback)
			case Function:
				return enqueueState(element, instance, enqueueCallback(element, instance, state), callback)
			default:
				element.state = element.work > WorkTask ? state : assign(instance.state, element.state, state)

				enqueueUpdate(element, instance, callback, ComponentUpdate)
		}
}

/**
 * @param {Element} Element
 * @param {Component} instance
 * @param {function} callback
 */
function enqueueCallback (element, instance, callback) {
	try {
		return callback.call(instance, instance.state, instance.props)
	} catch (e) {
		errorBoundary(element, e, LifecycleSetState+':'+LifecycleCallback, ErrorActive)
	}
}

/**
 * @param {Element} element
 * @param {Component} instance
 * @param {Promise} state
 * @param {function?} callback
 */
function enqueuePending (element, instance, state, callback) {
	state.then(function (value) {
		requestAnimationFrame(function () {
			enqueueState(element, instance, value, callback)
		})
	}).catch(function (e) {
		errorBoundary(element, e, LifecycleAsync+':'+LifecycleSetState, ErrorActive)
	})
}

/**
 * @param {Element} element
 * @param {Component} instance
 * @param {function=} callback
 * @param {number} signature
 */
function enqueueUpdate (element, instance, callback, signature) {
	if (element == null)
		return void requestAnimationFrame(function () {
			enqueueUpdate(getHostChildren(instance), instance, callback, signature)
		})

	if (element.work < WorkSync)
		return void requestAnimationFrame(function () {
			enqueueUpdate(element, instance, callback, signature)
		})

	if (!element.DOM)
		return

	componentUpdate(element, element, signature)

	if (typeof callback === 'function')
		enqueueCallback(element, instance, callback)
}

/**
 * @param {Element} element
 * @param {(Component|Element)} instance
 * @param {Object} state
 * @return {Object}
 */
function getInitialState (element, instance, state) {	
	if (state)
		switch (state.constructor) {
			case Promise:
				enqueuePending(element, instance, state)
			case Boolean:
				break
			default:
				return state
		}

	return instance.state || {}
}

/**
 * @param {Element} element
 * @return {Component}
 */
function getChildInstance (element) {
	try {
		return new element.type(element.props, element.context)
	} catch (e) {
		errorBoundary(element, e, LifecycleConstructor, ErrorActive)
	}

	return new Component()
}

/**
 * @param {Element} element
 * @return {Element}
 */
function getChildElement (element) {
	try {
		return commitElement(element.instance.render(element.instance.props, element.instance.state, element.context))
	} catch (e) {
		return commitElement(errorBoundary(element, e, LifecycleRender, ErrorActive))
	}
}

/**
 * @param {Element} element
 * @return {Object?}
 */
function getChildContext (element) {
	if (element.owner[LifecycleChildContext])
		return lifecycleData(element, LifecycleChildContext) || element.context || {}
	else
		return element.context || {}
}

/**
 * @param {Element} element
 * @return {Element}
 */
function getHostElement (element) {
	return element.flag !== ElementComponent ? element : getHostElement(element.children)
}

/**
 * @param  {(Element|Component)} element
 * @return {Element?}
 */
function getHostChildren (element) {
	return isValidElement(element) ? element : element[SymbolElement]
}

/**
 * @param {(function|string)} subject
 * @return {string}
 */
function getDisplayName (subject) {
	switch (typeof subject) {
		case 'function':
			return getDisplayName(subject.displayName || subject.name)
		case 'string':
			if (subject)
				return subject
		default:
			return (subject && subject.constructor.name) || 'anonymous'
	}
}

/**
 * @param {Element} element
 * @param {(Object|function)} defaultProps
 * @param {Object} props
 */
function getDefaultProps (element, defaultProps, props) {
	if (typeof defaultProps !== 'function')
		return assign({}, defaultProps, props)

	defineProperty(element.type, 'defaultProps', {
		value: getDefaultProps(element, lifecycleCallback(element, defaultProps), props)
	})

	return element.type.defaultProps
}
