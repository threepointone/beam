!function(e){"object"==typeof exports?module.exports=e():"function"==typeof define&&define.amd?define(e):"undefined"!=typeof window?window.beam=e():"undefined"!=typeof global?global.beam=e():"undefined"!=typeof self&&(self.beam=e())}(function(){var define,module,exports;
return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// first get your modules

var claw = require('claw'),
    Twain = require('twain'),
    _ = require('fn');

    // some globals 
    doc = document,
    unitless = {
        lineHeight: 1,
        zoom: 1,
        zIndex: 1,
        opacity: 1,
        transform: 1
    };

// which property name does this browser use for transform
var transform = function() {
    var styles = doc.createElement('a').style,
        props = ['WebkitTransform', 'mozTransform', 'OTransform', 'msTransform', 'Transform', 'transform'],
        i;
    for (i = 0; i < props.length; i++) {
        if (props[i] in styles) return props[i];
    }
}();

// a whole bunch of usefule functions

function camelize(s) {
    return s.replace(/-(.)/g, function(m, m1) {
        return m1.toUpperCase();
    });
}

function uppercase(p, a) {
    return a.toUpperCase();
}


function vendor(property) {
    // return the vendor prefix for a given property. should even work with firefox fudging -webkit.
    var div = doc.createElement('div');
    var x = 'Khtml moz Webkit O ms '.split(' '),
        i;
    for (i = x.length - 1; i >= 0; i--) {
        if (((x[i] ? x[i] + '-' : '') + property).replace(/\-(\w)/g, uppercase) in div.style) {
            return x[i] ? '-' + x[i].toLowerCase() + '-' : ''; // empty string, if it works without prefix
        }
    }
    return null; // not found...
}

function unit(style, def) {
    // extracts the unit part of the string. px, em, whatever. 
    return (/(%|in|cm|mm|em|ex|pt|pc|px|deg)+/.exec(style) || [def])[0];
}

function num(style) {
    // extracts the number part of the style
    return parseFloat(style, 10);
}

// initial style is determined by the elements themselves
var getStyle = doc.defaultView && doc.defaultView.getComputedStyle ? function(el, property) {
        property = property == 'transform' ? transform : property
        var value = null,
            computed = doc.defaultView.getComputedStyle(el, '');
        computed && (value = computed[camelize(property)]);
        return el.style[property] || value;
    } : html.currentStyle ?

    function(el, property) {
        property = camelize(property);

        if (property == 'opacity') {
            var val = 100;
            try {
                val = el.filters['DXImageTransform.Microsoft.Alpha'].opacity;
            } catch (e1) {
                try {
                    val = el.filters('alpha').opacity;
                } catch (e2) {}
            }
            return val / 100;
        }
        var value = el.currentStyle ? el.currentStyle[property] : null
        return el.style[property] || value;
    } : function(el, property) {
        return el.style[camelize(property)];
    };

function setStyle(el, prop, val) {
    // "special" setStyle
    // fyi: typeof val === 'number', or and rgb hash
    var b = el.__beam__;
    var prev = b.prev;

    if (typeof prop !== 'string') {
        _.each(prop, function(v, p) {
            setStyle(el, p, v);
        });
        return;
    }

    prop = camelize(prop);
    // ok, so this the weird part 
    // because we're getting a number, we need to add unit to it 
    // we get that directly from the __beam__ stored on the element
    // fuck me, right?
    // for perf, store a prev value on the __beam__. makes this infinitely more usable for multiple ui elements

    // first check if it's an rgb triplet
    if (val.r) {

        var color = rgb(val.r, val.g, val.b);
        if (color !== prev[prop]) {
            el.style[prop] = rgb(val.r, val.g, val.b);
            prev[prop] = color;

        }

        return;
    }


    if (prev[prop] !== val) {

        // the following line is easily the most expensive line in the entire lib. 
        // and that's why kids, you never make a css animation engine
        if (prop === 'zIndex') {
            val = Math.ceil(val);
        } // gah.
        el.style[prop] = val + (unitless[prop] ? '' : b.$t(prop).unit);
        prev[prop] = val;
    }

}

// convert rgb and short hex to long hex

function toHex(c) {
    var m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    // short skirt to long jacket
    return (m ? rgb(m[1], m[2], m[3]) : c).replace(/#(\w)(\w)(\w)$/, '#$1$1$2$2$3$3');
}

function encodeColor(hex) {
    // get an rgb triad from a hex/rgb() val
    hex = toHex(hex);
    return {
        r: 16 * parseInt(hex.charAt(1), 16) + parseInt(hex.charAt(2), 16),
        g: 16 * parseInt(hex.charAt(3), 16) + parseInt(hex.charAt(4), 16),
        b: 16 * parseInt(hex.charAt(5), 16) + parseInt(hex.charAt(5), 16)
    };
}

var rgbOhex = /^rgb\(|#/;

function rgb(r, g, b) {
    return '#' + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)
}

function encode(input) {
    // this will be our twain's encode function, responsible for converting strings and what not into numbers before being processed
    var o = {};
    _.each(input, function(val, prop) {
        // first convert the label to a vendor prefixed, camelized version
        prop = camelize(vendor(prop) || '' + prop);
        if (typeof val === 'string') {
            // if it's a color, then make the rgb triad
            if (rgbOhex.test(val)) {
                o[prop] = encodeColor(val);
                return;
            }
            o[prop] = num(val);
            // return;
        } else {
            o[prop] = val;
        }


    });
    return o;
}

// maintain of all "tractor beams".
var instances = [];

// set up a twain on an element, with update fns


function track(el) {
    // lemme know when proper object hashes become mainstream. 
    // until then, carry on young man
    if (el.__beam__) {
        return el.__beam__;
    }

    var twain = Twain({
        encode: encode
    }).update(function(step) {
        setStyle(el, step);
    });

    twain.prev = {}; // keep a place to cache previous step
    // run a separate one for transforms
    var transformer = twain.transformer = Twain().update(function(step) {
        // get back units
        var o = {};
        _.each(step, function(val, prop) {
            o[prop] = val + (unitless[prop] ? '' : transformer.$t(prop).unit);
        });

        // todo - optimize the cond. 
        if (claw.formatTransform(o) !== transformer.prev) {
            claw(el, o);
            transformer.prev = claw.formatTransform(o);
        }

    });

    transformer.prev = ''; // keep a place to cache previous step
    instances.push(twain);

    el.__beam__ = twain;
    return twain;
}


function beam(el, to) {
    // let's haul it in. , scotty. 
    var tracker = track(el);
    var o = {};
    _.each(to, function(val, prop) {
        prop = camelize(vendor(prop) + prop);
        // console.log(claw.transform, prop)
        if (prop === claw.transform) {
            _.each(val, function(v, p) {
                var tween = tracker.transformer.$t(p).to(num(v));
                tween.unit = unit(v, '') || tween.unit || '';
            });
            return;
        }

        if (!tracker.tweens[prop]) {
            var currentStyle = getStyle(el, prop) || '';
            if (rgbOhex.test(currentStyle)) {
                var tween = tracker.$t(prop, true).from(encodeColor(currentStyle));
            } else {
                var numerical = num(currentStyle);
                // this inits the specific Tween
                var tween = tracker.$t(prop).from(_.isValue(numerical) ? numerical : num(val));
                tween.unit = unit(currentStyle, '');
            }
        }
        var tween = tracker.$t(prop);
        if (typeof val === 'string' && !rgbOhex.test(val) && unit(val, '') !== tween.unit) {
            tween.unit = unit(val, '');
            tween.from(num(val));
        }
        tracker.$t(prop).to(rgbOhex.test(val) ? encodeColor(val) : num(val));
    });

    // return a curried version of self. awesome-o. 
    var fn = function(d) {
        return beam(el, d);
    };
    fn.multiply = function(n){
        el.__beam__.transformer.multiply(n);
    }
    return ;
}


// start off animation loop. 
// todo - start/stop
// requestAnimationFrame stuff.
var raf = window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    fallback;

var prev = new Date().getTime();

function fallback(fn) {
    var curr = new Date().getTime();
    var ms = Math.max(0, 16 - (curr - prev));
    setTimeout(fn, ms);
    prev = curr;
}

function animate() {

    // use a quick for loop
    for (var i = 0, j = instances.length; i < j; i++) {
        instances[i].update().transformer.update();
    }
    raf(animate);
}

animate();

// some more exports
// todo - remove these
beam.instances = instances;
beam.encode = encode;
beam.getStyle = getStyle;
beam.raf = raf;
beam._ = _;

module.exports = beam;
},{"claw":2,"fn":3,"twain":4}],2:[function(require,module,exports){
var _ = require('fn');
module.exports = claw;


var transform = (function() {
    var styles = document.createElement('a').style,
        props = ['WebkitTransform', 'mozTransform', 'OTransform', 'msTransform', 'Transform', 'transform'],
        i;
    for (i = 0; i < props.length; i++) {
        if (props[i] in styles) return props[i];
    }
})();

function formatTransform(v) {
    var str = '';
    _.each(v, function(val, prop) {
        str += (prop + '(' + val + ') '); // arrays should get normalized with commas
    });
    return str;
}

function claw(el, vals) {
    var t = this;
    el.__claw__ = el.__claw__ || {};
    el.__clawprev__ = el.__clawprev__ || '';

    _.extend(el.__claw__, vals);
    var str = formatTransform(el.__claw__);

    if (el.__clawprev__ !== str) {
        el.style[transform] = str;
        el.__clawprev__ = str

    }

    // return a curried function for further chaining
    return function(v) {
        return claw.call(t, el, v);
    }

}

claw.formatTransform = formatTransform;
claw.transform = transform;
},{"fn":3}],3:[function(require,module,exports){
// fair caveat, this is code collected from various places, and I don't have tests yet. YET.

"use strict";

module.exports = {
    isValue: isValue,
    identity: identity,
    indexOf: indexOf,
    keys: keys,
    values: values,
    isArray: isArray,
    toArray: toArray,
    each: each,
    extend: extend,
    map: map,
    times: times,
    invoke: invoke,
    filter: filter,
    find: find,
    reduce: reduce,
    debounce: debounce,
    compose: compose,
    chain: chain
};

var slice = [].slice,
    has = {}.hasOwnProperty,
    toString = {}.toString;

function isValue(v) {
    return v != null;
}

function identity(x) {
    return x;
}

function indexOf(arr, obj) {
    if (arr.indexOf) {
        return arr.indexOf(obj);
    }
    for (var i = 0; i < arr.length; ++i) {
        if (arr[i] === obj) {
            return i;
        }
    }
    return -1;
}

function keys(obj) {
    if (obj !== Object(obj)) {
        throw new TypeError('Invalid object');
    }
    var keys = [];
    for (var key in obj) {
        if (has.call(obj, key)) {
            keys.push(key);
        }
    }
    return keys;
}

function values(obj) {
    var values = [];
    for (var key in obj) {
        if (has.call(obj, key)) {
            values.push(obj[key]);
        }
    }
    return values;
}

function isArray(obj) {
    if (Array.isArray) {
        return Array.isArray(obj);
    }
    return toString.call(obj) === '[object Array]';
}

function toArray(obj) {
    if (!obj) {
        return [];
    }
    if (isArray(obj)) {
        return slice.call(obj);
    }
    if (obj.length === +obj.length) {
        return map(obj, identity);
    }
    return values(obj);
}

function each(obj, fn) {
    if (isArray(obj)) {
        for (var i = 0, j = obj.length; i < j; i++) {
            fn(obj[i], i);
        }
    } else {
        for (var prop in obj) {
            if (has.call(obj, prop)) {
                fn(obj[prop], prop);
            }
        }
    }
}

function extend(obj) {
    var args = slice.call(arguments, 1);
    for (var i = 0, j = args.length; i < j; i++) {
        var source = args[i];
        for (var prop in source) {
            if (has.call(source, prop)) {
                obj[prop] = source[prop];
            }
        }
    }
    return obj;
}

function map(obj, fn) {
    var arr = [];
    each(obj, function(v, k) {
        arr.push(fn(v, k));
    });
    return arr;
}

function times(n, fn) {
    var arr = [];
    for (var i = 0; i < n; i++) {
        arr[i] = fn(i);
    }
    return arr;
}

function invoke(obj, fnName) {
    var args = slice.call(arguments, 2);
    return map(obj, function(v) {
        return v[fnName].apply(v, args);
    });
}

function filter(arr, fn) {
    var ret = [];
    for (var i = 0, j = arr.length; i < j; i++) {
        if (fn(arr[i], i)) {
            ret.push(arr[i]);
        }
    }
    return ret;
}

function find(arr, fn) {
    for (var i = 0, j = arr.length; i < j; i++) {
        if (fn(arr[i], i)) {
            return arr[i];
        }
    }
    return null;
}

function reduce(arr, fn, initial) {
    var idx = 0;
    var len = arr.length;
    var curr = arguments.length === 3 ? initial : arr[idx++];

    while (idx < len) {
        curr = fn.call(null, curr, arr[idx], ++idx, arr);
    }
    return curr;
}

function debounce(func, wait, immediate) {
    var result;
    var timeout = null;
    return function() {
        var context = this,
            args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) {
                result = func.apply(context, args);
            }
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) {
            result = func.apply(context, args);
        }
        return result;
    };
}

function compose() {
    var funcs = arguments;
    return function() {
        var args = arguments;
        each(funcs, function(fn) {
            args = [fn.apply(this, args)];
        });
        return args[0];
    };
}

// chaining, à la underscore

function chain(obj) {
    if (!(this instanceof chain)) {
        return new chain(obj);
    }
    this._obj = obj;
}

each(module.exports, function(fn, name) {
    chain.prototype[name] = function() {
        this._obj = fn.apply(this, [this._obj].concat(slice.call(arguments, 0)));
        return this;
    };
});

chain.prototype.val = function() {
    return this._obj;
};
},{}],4:[function(require,module,exports){
var _ = require('fn');

function collect(obj, fn) {
    var o = {};
    _.each(obj, function(el, index) {
        o[index] = (typeof fn === 'string') ? el[fn] : fn(el, index);
    });
    return o;
}

function abs(n) {
    return n < 0 ? -n : n;
}

// defaults for a single tweener. pass these params into constructor to change the nature of the animation
var defaults = {
    // used for snapping, since the algorithm doesn't ever reach the 'end'
    threshold: 0.2,
    // fraction to moveby per frame * fps. this determines "speed"
    // defaults to ~ 15% * (1000/60)
    multiplier: 0.01,
    // timer function, so you can do a custom f(t)
    now: function() {
        return new Date().getTime();
    }
};


// meat and potatoes

function Tween(config) {
    if (!(this instanceof Tween)) return new Tween(config);

    this.config = config = _.extend({}, config);

    var t = this;

    // merge the defaults with self
    _.each(defaults, function(val, key) {
        t[key] = _.isValue(config[key]) ? config[key] : val;
    });
}

_.extend(Tween.prototype, {
    // Number: defines 'origin', ie - the number to start from
    from: function(from) {
        this._from = this.value = from;
        _.isValue(this._to) || this.to(from);
        return this;
    },
    // Number: defines 'destinations', ie - the number to go to
    to: function(to) {
        _.isValue(this._from) || this.from(to);
        this._to = to;
        return this;
    },
    // run one step of the tween. updates internal variables, and return spec object for this 'instant'
    step: function() {

        _.isValue(this.time) || (this.time = this.now());

        // this is the heart of the whole thing, really. 
        // an implementation of an exponential smoothing function
        // http://en.wikipedia.org/wiki/Exponential_smoothing
        var now = this.now(),
            period = now - this.time,
            fraction = Math.min(this.multiplier * period, 1),
            delta = fraction * (this._to - this.value),
            value = this.value + delta;

        // snap if we're close enough to the target (defined by `this.threshold`)
        if (abs(this._to - value) < this.threshold) {
            delta = this._to - this.value;
            this.value = value = this._to;
            fraction = 1;

        } else {
            this.value = value;
        }

        this.time = now;

        this._update({
            time: this.time,
            period: period,
            fraction: fraction,
            delta: delta,
            value: value
        });

        return this;

    },
    // default handler for every step. change this by using this.update(fn)
    _update: function() {
        // blank
    },
    // if function is passed, it registers that as the step handler. else, it executes a step and returns self
    update: function(fn) {
        if (!fn) return this.step();
        this._update = fn;
        return this;

    },
    // resets time var so that next time it starts with a fresh value
    stop: function() {
        this.time = null;
        return this;
    },
    multiply: function(n) {
        this.multiplier = typeof n === 'function' ? n.apply(this) : n;
    }

});


// Twain.
// this basically holds a collection of tweeners for easy usage. 
// check out examples on how to use.

function Twain(obj) {
    if (!(this instanceof Twain)) return new Twain(obj);

    _.extend(this, {
        config: obj || {},
        tweens: {}
    });

    this.encode = this.config.encode || _.identity;
    this.decode = this.config.decode || _.identity;

    // reset the config encode/decode functions. we don't want it to propogate through
    // ... or do we?        
    this.config.encode = this.config.decode = _.identity;

}

_.extend(Twain.prototype, {
    // convenience to get a tween for a prop, and generate if required.
    // send T == true to generate a nested twain instead
    $t: function(prop, T) {
        return (this.tweens[prop] || (this.tweens[prop] = (T ? Twain : Tween)(this.config)));
    },

    from: function(_from) {
        var t = this;
        var from = this.encode(_from);
        _.each(from, function(val, prop) {
            t.$t(prop, typeof val === 'object').from(val);
        });
        return this;
    },

    to: function(_to) {
        var t = this;
        var to = this.encode(_to);
        _.each(to, function(val, prop) {
            t.$t(prop, typeof val === 'object').to(val);
        });
        return this;
    },

    step: function() {
        var val = this.value = collect(this.tweens, function(tween) {
            return tween.step().value;
        });
        this._update(val);
        return this;
    },
    decoded: function() {
        return this.decode(this.value);
    },

    multiply: function(n) {
        _.each(this.tweens, function(t) {
            t.multiply(n);
        });
    },

    _update: function() {
        // blank
    },

    update: function(fn) {
        if (!fn) return this.step();
        this._update = fn;
        return this;
    },
    stop: function() {
        _.each(this.tweens, function(tween) {
            tween.stop();
        });
        return this;
    }
});

// export some pieces 
Twain.Tween = Tween;

module.exports = Twain;
},{"fn":3}]},{},[1])
(1)
});
;