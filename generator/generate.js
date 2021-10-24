const fs = require("fs-extra");
const path = require("path");

const sharp = require("sharp");

const sortKeys = require("sort-keys");

const debug = require("debug");
const log = debug("taterlibrary:generator");

const jsonRegex = /(.+)\.json$/;

const resizes = {
	"128x": 128,
	"256x": 256,
	"32x": 32,
	"64x": 64,
};

function wrap(taters, length) {
	return {
		length,
		taters,
	};
}

function compareTaters(a, b) {
	if (!a.firstAppearance || !a.firstAppearance.date) return -1;
	if (!b.firstAppearance || !b.firstAppearance.date) return 1;

	const dateCompare = new Date(a.firstAppearance.date) - new Date(b.firstAppearance.date);
	if (dateCompare === 0 && a.firstAppearance.order && b.firstAppearance.order) {
		return a.firstAppearance.order - b.firstAppearance.order;
	}

	return dateCompare;
}

async function getRawTaters() {
	const files = await fs.readdir("../data");
	const rawTaters = [];

	for (const file of files) {
		const match = file.match(jsonRegex);
		if (match === null) {
			log("unknown file in data directory: '%s'", file);
			continue;
		}

		const rawTater = await fs.readJson(path.resolve("../data", file));
		rawTater.id = match[1];

		rawTaters.push(rawTater);
	}

	return rawTaters.sort(compareTaters);
}

async function generate() {
	const taters = [];
	const tatersById = {};
	const tatersByLibraryNumber = {};

	const rawTaters = await getRawTaters();
	let libraryNumber = 1;
	for (const tater of rawTaters) {
		tater.libraryNumber = libraryNumber;

		try {
			const image = await fs.readFile(path.resolve("../image", tater.id + ".png"));

			tater.images = {
				full: "image/full/" + tater.id + ".png",
			};
			await fs.outputFile("./output/image/full/" + tater.id + ".png", image);

			for (const [ resize, width ] of Object.entries(resizes)) {
				const resizedImage = await sharp(image).resize(width).toBuffer();
				tater.images[resize] = "image/" + resize + "/" + tater.id + ".png",
				await fs.outputFile("./output/image/" + resize + "/" + tater.id + ".png", resizedImage);
			}
		} catch (error) {
			if (error.code === "ENOENT") {
				log("tater with id '%s' has no image", tater.id);
			} else {
				throw error;
			}
		}

		const sortedTater = sortKeys(tater, {
			deep: true,
		});

		taters.push(sortedTater);
		tatersById[tater.id] = sortedTater;
		tatersByLibraryNumber[tater.libraryNumber] = sortedTater;

		libraryNumber += 1;
	}

	const length = taters.length;
	log("found %d tater%s", length, length === 1 ? "" : "s");

	fs.outputJson("./output/listing/all.json", wrap(taters, length));
	fs.outputJson("./output/listing/by_id.json", wrap(tatersById, length));
	fs.outputJson("./output/listing/by_library_number.json", wrap(tatersByLibraryNumber, length));
}
generate();
