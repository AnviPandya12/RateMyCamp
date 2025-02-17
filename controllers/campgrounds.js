const Campground = require('../models/campground');
const maptilerClient = require("@maptiler/client");
maptilerClient.config.apiKey = process.env.MAPTILER_TOKEN;
const { cloudinary } = require("../cloudinary");

module.exports.index = async (req, res) => {
    try {
        const campgrounds = await Campground.find({});
        res.render('campgrounds/index', { campgrounds });
    } catch (error) {
        req.flash('error', 'Cannot load campgrounds.');
        res.redirect('/');
    }
}

module.exports.renderNewForm = (req, res) => {
    res.render('campgrounds/new');
}

module.exports.createCampground = async (req, res, next) => {
        const geoData = await maptilerClient.geocoding.forward(req.body.campground.location, { limit: 1 });
        const campground = new Campground(req.body.campground);
        campground.geometry = geoData.features[0].geometry; 
        campground.images = req.files.map(f => ({ url: f.path, filename: f.filename }));
        campground.author = req.user._id;
        await campground.save();
        console.log(campground);
        req.flash('success', 'Successfully made a new campground!');
        res.redirect(`/campgrounds/${campground._id}`);
        req.flash('error', 'Could not create campground.');
        res.redirect('/campgrounds/new');
    }


module.exports.showCampground = async (req, res) => {
    try {
        const campground = await Campground.findById(req.params.id).populate({
            path: 'reviews',
            populate: {
                path: 'author'
            }
        }).populate('author');
        if (!campground) {
            req.flash('error', 'Cannot find that campground!');
            return res.redirect('/campgrounds');
        }
        res.render('campgrounds/show', { campground });
    } catch (error) {
        req.flash('error', 'Could not display campground.');
        res.redirect('/campgrounds');
    }
}

module.exports.renderEditForm = async (req, res) => {
    try {
        const { id } = req.params;
        const campground = await Campground.findById(id);
        if (!campground) {
            req.flash('error', 'Cannot find that campground!');
            return res.redirect('/campgrounds');
        }
        res.render('campgrounds/edit', { campground });
    } catch (error) {
        req.flash('error', 'Could not load the edit form.');
        res.redirect('/campgrounds');
    }
}

module.exports.updateCampground = async (req, res) => {
    try {
        const { id } = req.params;
        const campground = await Campground.findByIdAndUpdate(id, { ...req.body.campground });

        // Update geometry if location is changed
        const geoData = await maptilerClient.geocoding.forward(req.body.campground.location, { limit: 1 });
        if (geoData && geoData.features && geoData.features[0]) {
            campground.geometry = geoData.features[0].geometry;
        }

        const imgs = req.files.map(f => ({ url: f.path, filename: f.filename }));
        campground.images.push(...imgs);
        await campground.save();

        if (req.body.deleteImages) {
            for (let filename of req.body.deleteImages) {
                await cloudinary.uploader.destroy(filename);
            }
            await campground.updateOne({ $pull: { images: { filename: { $in: req.body.deleteImages } } } });
        }
        req.flash('success', 'Successfully updated campground!');
        res.redirect(`/campgrounds/${campground._id}`);
    } catch (error) {
        req.flash('error', 'Could not update campground.');
        res.redirect(`/campgrounds/${id}/edit`);
    }
}

module.exports.deleteCampground = async (req, res) => {
    try {
        const { id } = req.params;
        await Campground.findByIdAndDelete(id);
        req.flash('success', 'Successfully deleted campground');
        res.redirect('/campgrounds');
    } catch (error) {
        req.flash('error', 'Could not delete campground.');
        res.redirect('/campgrounds');
    }
}
