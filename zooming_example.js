// Zoom.js 참고

let zoom = (function () {
    var TRANSITION_DURATION = 50;
    var level = 1;
    var panEngageTimeout = -1,
        panUpdateInterval = -1;
    var callbackTimeout = -1;
    var supportsTransforms = 'WebkitTransform' in document.body.style ||
        'MozTransform' in document.body.style ||
        'msTransform' in document.body.style ||
        'OTransform' in document.body.style ||
        'transform' in document.body.style;
    if (supportsTransforms) {
        document.body.style.transition = 'transform ' + TRANSITION_DURATION + 'ms ease';
        document.body.style.OTransition = '-o-transform ' + TRANSITION_DURATION + 'ms ease';
        document.body.style.msTransition = '-ms-transform ' + TRANSITION_DURATION + 'ms ease';
        document.body.style.MozTransition = '-moz-transform ' + TRANSITION_DURATION + 'ms ease';
        document.body.style.WebkitTransition = '-webkit-transform ' + TRANSITION_DURATION + 'ms ease';
    }
    function magnify(rect, scale) {
        var scrollOffset = getScrollOffset();
        rect.width = rect.width || 1;
        rect.height = rect.height || 1;
        rect.x -= (window.innerWidth - (rect.width * scale)) / 2;
        rect.y -= (window.innerHeight - (rect.height * scale)) / 2;
        if (supportsTransforms) {
            // Reset
            if (scale === 1) {
                document.body.style.transform = '';
                document.body.style.OTransform = '';
                document.body.style.msTransform = '';
                document.body.style.MozTransform = '';
                document.body.style.WebkitTransform = '';
            }
            // Scale
            else {
                var origin = scrollOffset.x + 'px ' + scrollOffset.y + 'px',
                    transform = 'translate(' + -rect.x + 'px,' + -rect.y + 'px) scale(' + scale + ')';

                document.body.style.transformOrigin = origin;
                document.body.style.OTransformOrigin = origin;
                document.body.style.msTransformOrigin = origin;
                document.body.style.MozTransformOrigin = origin;
                document.body.style.WebkitTransformOrigin = origin;

                document.body.style.transform = transform;
                document.body.style.OTransform = transform;
                document.body.style.msTransform = transform;
                document.body.style.MozTransform = transform;
                document.body.style.WebkitTransform = transform;
            }
        }
        else {
            // Reset
            if (scale === 1) {
                document.body.style.position = '';
                document.body.style.left = '';
                document.body.style.top = '';
                document.body.style.width = '';
                document.body.style.height = '';
                document.body.style.zoom = '';
            }
            // Scale
            else {
                document.body.style.position = 'relative';
                document.body.style.left = (- (scrollOffset.x + rect.x) / scale) + 'px';
                document.body.style.top = (- (scrollOffset.y + rect.y) / scale) + 'px';
                document.body.style.width = (scale * 100) + '%';
                document.body.style.height = (scale * 100) + '%';
                document.body.style.zoom = scale;
            }
        }

        level = scale;
    }
    function getScrollOffset() {
        return {
            x: window.scrollX !== undefined ? window.scrollX : window.pageXOffset,
            y: window.scrollY !== undefined ? window.scrollY : window.pageYOffset
        }
    }
    return {
        to: function (options) {
            if (level !== 1) {
                zoom.out();
            }
            else {
                options.x = options.x || 0;
                options.y = options.y || 0;
                if (!!options.element) {
                    var padding = typeof options.padding === 'number' ? options.padding : 20;
                    var bounds = options.element.getBoundingClientRect();
                    options.x = bounds.left - padding;
                    options.y = bounds.top - padding;
                    options.width = bounds.width + (padding * 2);
                    options.height = bounds.height + (padding * 2);
                }
                if (options.width !== undefined && options.height !== undefined) {
                    options.scale = Math.max(Math.min(window.innerWidth / options.width, window.innerHeight / options.height), 1);
                }
                if (options.scale > 1) {
                    options.x *= options.scale;
                    options.y *= options.scale;
                    options.x = Math.max(options.x, 0);
                    options.y = Math.max(options.y, 0);
                    magnify(options, options.scale);
                    if (typeof options.callback === 'function') {
                        callbackTimeout = setTimeout(options.callback, TRANSITION_DURATION);
                    }
                }
            }
        },
        out: function (options) {
            clearTimeout(panEngageTimeout);
            clearInterval(panUpdateInterval);
            clearTimeout(callbackTimeout);
            magnify({ x: 0, y: 0 }, 1);
            level = 1;
        },
        magnify: function (options) { this.to(options) },
        reset: function () { this.out() },
        zoomLevel: function () {
            return level;
        }
    }

})();


/**사용 예시 */

// DOM element에 대해 zoom
zoom.to({
    element: 타겟_엘레멘트,

    // Zoom 수행 이후 불려지는 callback 함수
    callback: function () {
        console.log("after zooming!");

        // Do something
    }
});

// Zoom out
zoom.out();

// Zoom level 설정
zoom.zoomLevel(number);