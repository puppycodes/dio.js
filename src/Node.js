/**
 * Create
 *
 * @param {Tree} newer
 * @param {Tree} parent
 * @param {Tree} sibling
 * @param {Number} _action
 * @param {Tree?} _host
 * @param {String?} _xmlns
 */
function create (newer, parent, sibling, _action, _host, _xmlns) {
	var host = _host;
	var xmlns = _xmlns;
	var action = _action;
	var group = newer.group;
	var flag = newer.flag;
	var type = 2;
	var skip = false;
	var owner;
	var node;
	var temp;

 	// cache host
 	if (host !== SHARED) {
		newer.host = host;
 	}

 	// component
 	if (group !== STRING) {
 		if (group === CLASS) {
 			host = newer;
 		}

 		extract(newer, true);

 		flag = newer.flag;
 		owner = newer.owner;
 	}

 	switch (flag) {
 		// text
 		case TEXT: {
 			node = newer.node = createTextNode(newer.children);
 			type = 1;
 			break;
 		}
 		// composite
 		case COMPOSITE: {
 			create(temp = newer.children[0], parent, sibling, action, newer, xmlns);
 			node = newer.node = temp.node;
			type = 0;
 			break;
 		} 		
 		default: {
 			var children = newer.children;
			var length = children.length;

			switch (flag) {
				case PORTAL: {
					node = newer.tag;
					action = 0;
					break;
				}
				case CUSTOM: {
					node = createCustomElement(newer, host)
					break;
				}
				default: {
	 				var tag = newer.tag;

	 				// cache namespace
	 				if (newer.xmlns !== null) {
	 					xmlns = newer.xmlns;
	 				}

		 			// namespace(implicit) svg/math roots
		 			switch (tag) {
		 				case 'svg': xmlns = svg; break;
		 				case 'math': xmlns = math; break;
		 				case '!doctype': tag = 'html'; break;
		 			}

		 			node = createElement(tag, newer, host, xmlns);
				}
			}

			// error
			if (newer.flag === ERROR) {
				create(node, parent, sibling, action, host, xmlns);
				assign(newer, node, newer.group === 0);
				return;
			}

			newer.node = node;

 			if (length > 0) {
 				for (var i = 0; i < length; i++) {
 					var child = children[i];

 					// hoisted
 					if (child.node !== null) {
 						child = assign(children[i] = new Tree(child.flag), child, true);
 					}

 					create(child, newer, sibling, 1, host, xmlns);
 				}
 			}
 		}
 	}

	if (group !== STRING && owner.componentWillMount !== void 0) {
		mountBoundary(newer, owner, node, 0);
	}

	newer.parent = parent;

	if (type !== 0) {
		switch (action) {
			case 1: appendChild(newer, parent); break;
			case 2: insertBefore(newer, sibling, parent); break;
			case 3: skip = remove(sibling, newer, parent); break;
		}

		if (type !== 1) {
			attribute(newer, xmlns, false);
		}
	}

	if (group !== STRING && skip !== true && owner.componentDidMount !== void 0) {
		mountBoundary(newer, owner, node, 1);
	}
}

/**
 * Extract
 *
 * @param {Tree} older
 * @param {Boolean} abstract
 * @return {Tree}
 */
function extract (older, abstract) {
	var type = older.type;
	var props = older.props;
	var children = older.children;
	var group = older.group;
	var length = children.length;
	var defaults = type.defaultProps;
	var types = type.propTypes;
	var skip = false;
	var newer;
	var result;

	if (props === PROPS) {
		props = {};
	}

	if (length !== 0) {
		props.children = children;
	}

	if (defaults !== void 0) {
		merge(getInitialStatic(type, defaults, 'defaultProps', props), props);
	}

	if (types !== void 0) {
		getInitialStatic(type, types, 'propTypes', props);
	}

	if (group === CLASS) {
		var proto = type.prototype;
		var UUID = proto.UUID;
		var owner;

		if (UUID === 2) {
			if ((owner = new type(props)).props === PROPS) {
				owner.props = props
			}
		} else {
			if (UUID !== 1) {
				extendClass(type, proto);
			}

			owner = new type(props);
			Component.call(owner, props);
		}

		older.owner = owner;

		if (owner.getInitialState !== void 0) {
			getInitialState(older, dataBoundary(SHARED, owner, 1, owner.props));

			if (older.async === PENDING) {
				if (server === true) {
					return older;
				} else {
					skip = true;
					newer = text(' ');
				}
			}
		}

		if (skip !== true) {
			older.async = PROCESSING;
			newer = renderBoundary(older, group);
			older.async = READY;
		}

		owner.this = older;
	} else {
		older.owner = type;
		newer = renderBoundary(older, group);
	}

	result = shape(newer, older, abstract);

	older.tag = result.tag;
	older.flag = result.flag;
	older.attrs = result.attrs;
	older.xmlns = result.xmlns;
	older.children = result.children;

	return result;
}

/**
 * Shape
 *
 * @param {Any} value
 * @param {Tree?} older
 * @param {Boolean} abstract
 * @return {Tree}
 */
function shape (value, older, abstract) {
	var newer = (value !== null && value !== void 0) ? value : text(' ');

	switch (newer.flag) {
		case FRAGMENT: {
			if (newer.type !== null) {
				switch (newer.type.constructor) {
					case Array: {
						return fragment(newer)
					}
					case Promise: {
						return (resolve(older, newer.type), newer)
					}
				}
			}
		}
		case void 0: {
			switch (newer.constructor) {
				case Function: {
					newer = element(newer);
					break;
				}
				case String: {
					if (newer.length === 0) {
						newer = ' ';
					}
				}
				case Number: {
					return text(newer);
				}
				case Array: {
					return fragment(newer);
				}
				case Date: {
					return text(newer.toString());
				}
				case Object: {
					return stringify(newer);
				}
				case Promise: {
					if (older !== null && older.flag !== EMPTY) {
						return resolve(older, newer, true);
					}
				}
				case Boolean: {
					return text(' ');
				}
				default: {
					if (older === null || newer.next === void 0) {
						return newer.ELEMENT_NODE === 1 ? element(newer) : text(' ');
					}

					newer = coroutine(older, newer);
				}
			}
		}
	}

	if (abstract === true && newer.group !== STRING) {
		return compose(newer);
	} else {
		return newer;
	}
}

/**
 * Resolve
 *
 * @param {Tree} older
 * @param {Promise} value
 */
function resolve (older, value) {
	older.async = PENDING;

	value.then(function (value) {		
		if (older.node === null) {
			return;
		}

		var newer = shape(value, older, true);

		older.async = READY;

		if (older.tag !== newer.tag) {
			exchange(older, newer, false);
		} else {
			newer.type = older.type;
			patch(older, newer, 0);
		}
	});

	return older.node === null ? text(' ') : older
}

/**
 * Coroutine
 *
 * @param {Tree} older
 * @param {Generator} generator
 * @return {Tree}
 */
function coroutine (older, generator) {
	var previous;
	var current;

	older.yield = function () {
		var supply = generator.next(previous);
		var next = supply.value;

		if (supply.done === true) {
			current = shape(next !== void 0 && next !== null ? next : previous, older, true);
		} else {
			current = shape(next, older, true);
		}

		return previous = current;
	};

	return shape(renderBoundary(older, older.group), older, true);
}

/**
 * Fill
 *
 * @param {Tree} older
 * @param {Tree} newer
 * @param {Number} length
 */
function fill (older, newer, length) {
	var children = newer.children;
	var host = older.host;

	for (var i = 0, child; i < length; i++) {
		create(child = children[i], older, SHARED, 1, host, null);
	}

	older.children = children;
}

/**
 * Animate
 *
 * @param {Tree} older
 * @param {Tree} newer
 * @param {tree} parent
 * @param {Promise} pending
 * @param {Node} node
 */
function animate (older, newer, parent, pending) {
	pending.then(function () {
		if (parent.node === null || older.node === null) {
			return;
		}

		if (newer === SHARED) {
			removeChild(older, parent);
		} else if (newer.node !== null) {
			replaceChild(older, newer, parent);

			if (newer.group !== STRING && newer.owner.componentDidMount !== void 0) {
				mountBoundary(newer, newer.owner, newer.node, 1);
			}
		}

		unmount(older);
		detach(older);
	});
}

/**
 * Remove
 *
 * @param {Tree} older
 * @param {Tree} newer
 * @param {Tree} parent
 * @return {Tree}
 */
function remove (older, newer, parent) {
	if (older.group !== STRING && older.owner.componentWillUnmount !== void 0) {
		var pending = mountBoundary(older, older.owner, older.node, 2);

		if (pending !== void 0 && pending !== null && pending.constructor === Promise) {
			animate(older, newer, parent, pending, older.node);

			return true;
		}
	}

	unmount(older);

	if (newer === SHARED) {
		removeChild(older, parent);
		detach(older);
	} else {
		replaceChild(older, newer, parent);
	}

	return false;
}

/**
 * Unmount
 *
 * @param {Tree} older
 */
function unmount (older) {
	var children = older.children;
	var length = children.length;
	var flag = older.flag;

	if (flag !== TEXT) {
		if (length !== 0) {
			for (var i = 0; i < length; i++) {
				var child = children[i];

				if (child.group !== STRING && child.owner.componentWillUnmount !== void 0) {
					mountBoundary(child, child.owner, child.node, 2);
				}

				unmount(child);
				detach(child);
			}
		}

		if (older.ref !== null) {
			refs(older, older.ref, 0);
		}
	}
}

/**
 * Detach
 *
 * @param {Tree}
 */
function detach (older) {
	older.parent = null;
	older.owner = null;
	older.node = null;
	older.host = null;
}

/**
 * Exchange
 *
 * @param {Tree} newer
 * @param {Tree} older
 * @param {Boolean} deep
 */
function exchange (older, newer, deep) {
	change(older, newer, older.host);
	assign(older, newer, deep);
	update(older.host, newer);
}

/**
 * Update
 *
 * @param {Tree} older
 * @param {Tree} newer
 */
function update (older, newer) {
	if (older !== null && older.flag === COMPOSITE) {
		older.node = newer.node;
		older.parent = newer.parent;

		if (older.host !== older) {
			update(older.host, newer);
		}
	}
}

/**
 * Change
 *
 * @param {Tree} older
 * @param {Tree} newer
 */
function change (older, newer) {
	create(newer, older.parent, older, 3, older.host, null);
}
