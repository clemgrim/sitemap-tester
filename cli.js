#!/usr/bin/env node

var yargs = require('yargs');
var fs = require('fs');
var symbols = require('log-symbols');
var chalk = require('chalk');
var sitemap = require('./');
var argv;

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

sitemap.get(argv.url, function (err, data) {
	if (err) {
		die(err, argv.url);
	}
	
	console.log(chalk.green('>'), ' Sitemap analysé : ', chalk.cyan(data.urlset.url.length, ' urls à valider'));
	
	progress();
	interval = setInterval(progress, 2000);
	
	sitemap.explore(data, function (e, stats) {
		clear();
		
		if (e) {
			die(e, argv.url);
		}
		
		console.log(symbols.success + ' Success: ', stats.success);
		console.log(symbols.error + ' Fail: ', stats.fail);

		if (stats.errors.length) {
			console.log('\n');
			
			stats.errors.forEach(function (page) {
				console.log(chalk.gray('[' + page.status + ']'), page.url);
			});
		}

		if (argv.write) {
			fs.writeFile('./sitemap.json', JSON.stringify(stats, null, 2), function (err) {
				if (err) {
					die(err);
				}
				
				console.log('\n');
				console.log(chalk.green('>>') + ' Fichier écrit ' + chalk.cyan('./sitemap.json'));
				
				if (argv.open) {
					require('opn')('./sitemap.json');
				}
			});
		}
	});
});

function clear() {
	clearInterval(interval);
	console.log('\n');
}

function die(msg, reason) {
	msg = msg || 'Une erreur est survenue'
	console.log(chalk.red(msg), status ? chalk.cyan(reason) : '');
	process.exit(0);
}

function progress () {
	process.stdout.write('.');
}
