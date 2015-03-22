var redtape = require('redtape')
var async = require('async')
var _ = require('lodash')
var memwatch = require('memwatch')
var callback = function() {}

var it = redtape({
    beforeEach: function (next) {
        var stashback = require('..')({ timeout: 500 })
        var stash = _.curry(stashback.stash)
        var unstash = _.curry(stashback.unstash)
        next(null, stash, unstash, stashback.stats)
    }
});

it('should stash callbacks', function(test, stash, unstash, stats) {
    test.plan(2)
    stash('key', callback, {}, function(err) {
        test.error(err)
        test.equal(stats().stashed, 1)
    })
})

it('should unstash callbacks', function(test, stash, unstash, stats) {
    test.plan(3)
    async.waterfall([
        stash('key', callback, {}),
        unstash('key', unstash)
    ], function(err, unstashed) {
        test.error(err)
        test.equal(unstashed, callback)
        test.equal(stats().stashed, 0)
    })
})

it('should reject duplicate keys', function(test, stash, unstash, stats) {
    test.plan(2)
    async.series([
        stash('key', callback, {}),
        stash('key', callback, {})
    ], function(err) {
        test.assert(err)
        test.equal(err.message, "Duplicate key: key")
    })
})

it('should unstash an unknown key', function(test, stash, unstash, stats) {
    test.plan(3)
    async.waterfall([
        unstash('key', {})
    ], function(err, unstashed) {
        test.assert(err)
        test.equal(err.message, "Unknown key: key")
        test.assert(_.isFunction(unstashed))
    })
})

it('should expire callbacks after the stash timeout', function(test, stash, unstash, stats) {
    test.plan(6)

    var callback = function(err) {
        test.assert(err)
        test.equal(err.message, "Expired by stashback")
    }

    stash('key', callback, { timeout: 300 }, function(err) {
        test.error(err)
        setTimeout(function() {
            unstash('key', {}, function(err) {
                test.assert(err)
                test.equal(err.message, "Unknown key: key")
                test.equal(stats().expired, 1)
            })
        }, 400)
    })
})

it('should expire callbacks after the global timeout', function(test, stash, unstash, stats) {
    test.plan(6)

    var callback = function(err) {
        test.assert(err)
        test.equal(err.message, "Expired by stashback")
    }

    stash('key', callback, {}, function(err) {
        test.error(err)
        setTimeout(function() {
            unstash('key', {}, function(err) {
                test.assert(err)
                test.equal(err.message, "Unknown key: key")
                test.equal(stats().expired, 1)
            })
        }, 600)
    })
})

it('should not leak memory', function(test, stash, unstash, stats) {

    test.plan(11)

    memwatch.on('stats', function(stats) {
        test.equal(stats.usage_trend, 0)
    })

    async.times(1000, function(index, next) {
        stash(index, callback, {}, next)
        if (index % 100 === 0) {
            global.gc()
        }
    }, function(err) {
        test.error(err)
    })
})
