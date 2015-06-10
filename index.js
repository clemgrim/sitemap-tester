var request = require('request');
var _ = require('lodash');
var chalk = require('chalk');
var xml = require('xml2js');
var symbols = require('log-symbols');
var Q = require('q');
var yargs = require('yargs');
var url, interval, argv;
var fs = require('fs');
var exec = require('child_process').exec;
var start = new Date();

argv = yargs.usage('Usage: $0 -u <url>')
			.alias('u', 'url')
			.alias('w', 'write')
			.alias('h', 'help')
			.alias('o', 'open')
			.alias('v', 'version')
			.describe('u', 'Url du site')
			.describe('w', 'Ecrire les résultats')
			.describe('o', 'Ouvre le fichier')
			.boolean('o')
			.boolean('w')
			.version(function() {return require('./package').version;})
			.argv;

if (argv.help) {
	yargs.showHelp();
	process.exit(0);
}

url = argv.url;

if (!url) {
	die('Veuillez fournir une url');
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
		
		console.log(chalk.green('>'), ' Sitemap analysé : ', chalk.cyan(data.urlset.url.length, ' urls à valider'));
		
		progress();
		interval = setInterval(progress, 2000);
		
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
				}, i * 1000)
				
				promises.push(dfd.promise);
			});
		});
		
		return Q.all(promises);
	})
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
		
		dfd.resolve({yep: yep, nope: nope, total: res.length});
		
		return dfd.promise;
	})
	.then(function (stats) {
		clear();
		
		console.log(symbols.success + ' Success: ', stats.yep.length);
		console.log(symbols.error + ' Fail: ', stats.nope.length);
		
		if (stats.nope.length) {
			console.log('\n');
			
			stats.nope.forEach(function (page) {
				console.log(chalk.gray('[' + page.status + ']'), page.url);
			});
		}
		
		if (argv.write) {
			var now = new Date();
			var output = {
              sitemap: url,
			  date: start.toLocaleString(),
			  time: (now.getTime() - start.getTime()) / 1000,
			  pages: stats.total,
			  success: stats.yep.length,
			  fail: stats.nope.length,
			  errors: stats.nope
			};
			
			return Q.nfcall(fs.writeFile, 'sitemap.json', JSON.stringify(output, null, 2));
		}
		
		return Q.promise(function (r) {
			r(false);
		})
	})
	.then(function (status) {
		if (status !== false) {
			console.log('\n');
			console.log(chalk.green('>>') + ' Fichier écrit ' + chalk.cyan('./sitemap.json'));
			
			if (argv.open) {
				require('opn')('./sitemap.json');
			}
		}
	})
	.fail(function (msg) {
		clear();
		die(msg, url);
	});

function clear() {
	clearInterval(interval);
	console.log('\n');
}

function die(msg, status) {
	msg = msg || 'Une erreur est survenue'
	console.log(chalk.red(msg), status ? chalk.cyan(url) : '');
	process.exit(0);
}

function progress () {
	process.stdout.write('.');
}