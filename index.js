var request = require('request');
var _ = require('lodash');
var xml = require('xml2js');
var Q = require('q');
var start = new Date();

module.exports.get = function (url, cb) {
	cb = cb || _.noop;

	if (!url) {
		cb('Veuillez fournir une url');
		return;
	}

	url = _.trimRight(url, '/') + '/sitemap.xml';

	Q.nfcall(request.get, url)
		.then(function (res) {
			if (res[0].statusCode !== 200) {
				throw new Error('Impossible d\'ouvrir le sitemap');
			}
	
			return Q.nfcall(xml.parseString, res[1]);
		})
		.then(function (data) {
			if (!data.urlset || !_.isArray(data.urlset.url)) {
				throw new Error ('Sitemap invalide');
			}
			
			data.sitemapUrl = url;
			
			cb(null, data);
		})
		.fail(function (msg) {
			cb(msg);
		});
};

module.exports.explore = function (data, cb) {
	cb = cb || _.noop;
	
	var promises = [];
	
	_.chunk(data.urlset.url, 5).forEach(function (group, i) {
		group.forEach(function (entry, k) {
			var url = entry.loc[0];
			
			var dfd = Q.defer();
			
			setTimeout(function () {
				request.head(url, function (err, res, body) {
					if (err) {
						dfd.reject(err);
					} else {
						dfd.resolve(res);
					}
				});
			}, i * 800)
			
			promises.push(dfd.promise);
		});
	});
	
	Q.all(promises)
		.then(function (res) {
			var yep = [], nope = [], dfd = Q.defer();
			
			res.forEach(function (r) {
				var uri = r.request.uri.href;
					
				if (r.statusCode !== 200) {
					nope.push({url: uri, status: r.statusCode});
				} else {
					yep.push({url: uri, status: r.statusCode});
				}
			});
			
			dfd.resolve({yep: yep, nope: nope, total: res.length, url: data.sitemapUrl});
			
			return dfd.promise;
		})
		.then(function (stats) {
			var now = new Date();
			var output = {
	          sitemap: stats.url,
			  date: start.toLocaleString(),
			  time: (now.getTime() - start.getTime()) / 1000,
			  pages: stats.total,
			  success: stats.yep.length,
			  fail: stats.nope.length,
			  errors: stats.nope
			};
			
			cb(null, output);
		})
		.fail(function (msg) {
			cb(msg);
		});
};