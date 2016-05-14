'use strict';

var Files = {

    // cache: supported extension for each type of file
    supported: {
        video: ['.3g2', '.3gp', '.3gp2', '.3gpp', '.60d', '.ajp', '.asf', '.asx', '.avchd', '.avi', '.bik', '.bix', '.box', '.cam', '.dat', '.divx', '.dmf', '.dv', '.dvr-ms', '.evo', '.flc', '.fli', '.flic', '.flv', '.flx', '.gvi', '.gvp', '.h264', '.m1v', '.m2p', '.m2ts', '.m2v', '.m4e', '.m4v', '.mjp', '.mjpeg', '.mjpg', '.mkv', '.moov', '.mov', '.movhd', '.movie', '.movx', '.mp4', '.mpe', '.mpeg', '.mpg', '.mpv', '.mpv2', '.mxf', '.nsv', '.nut', '.ogg', '.ogm', '.omf', '.ps', '.qt', '.ram', '.rm', '.rmvb', '.swf', '.ts', '.vfw', '.vid', '.video', '.viv', '.vivo', '.vob', '.vro', '.wm', '.wmv', '.wmx', '.wrap', '.wvx', '.wx', '.x264', '.xvid'],
        subtitle: ['.srt', '.sub', '.smi', '.txt', '.ssa', '.ass', '.mpl']
    },

    // AUTO: detect file type based on its extension
    detectFileType: function (file) {
        var ext = path.extname(file).toLowerCase();
        if (Files.supported.video.indexOf(ext) > -1) {
            return 'video';
        } else if (Files.supported.subtitle.indexOf(ext) > -1) {
            return 'subtitle';
        } else {
            return null;
        }
    },

    // AUTO: try to guess if video is HD or not, based on name. Failsafe for mediainfo
    extractQuality: function (title) {
        console.info('Detecting quality...');
        if (title.match(/720[pix]/i) && !title.match(/dvdrip|dvd\Wrip/i)) {
            return '720p';
        }
        if (title.match(/1080[pix]/i)) {
            return '1080p';
        }
        return false;
    },

    // AUTO: clears filename of common unneeded words or char
    clearName: function (name) {
        var title = path.parse(name).name;
        return title
            .replace(/(400|480|720|1080)[pix]/gi, '') // quality clean
            .replace(/[xh]26\d|hevc|xvid|divx/gi, '') // codecs
            .replace(/bluray|bdrip|brrip|dsr|dvdrip|dvd\Wrip|hdtv|\Wts\W|telesync|\Wcam\W/gi, '') // source
            .replace(/\Wextended\W|\Wproper/ig, '') // specials
            .replace(/[\.]/g, ' ') // has '.'
            .replace(/^\[.*\]/, '') // starts with brackets
            .replace(/\[(\w|\d)+\]/g, '') // remove brackets
            .replace(/\((\w|\d)+\)/g, '') // remove parenthesis
            .replace(/_/g, ' ') // has '_'
            .replace(/-/g, ' ') // has '-'
            .replace(/\-$/, '') // ends with '-'
            .replace(/\s.$/, '') // ends with ' '
            .replace(/^\./, '') // starts with '.'
            .replace(/^\-/, '') // starts with '-'
            .replace(/ +/g, ' '); // has multiple spaces
    },

    // USERINTERACTION or AUTO: auto-detect subtitle lang based on npm detect-lang
    detectSubLang: function () {
        var sub = $('#subtitle-file-path').val();

        // don't run without subs, even on click
        if (!sub || sub === '') {
            Interface.animate($('#subtitle-file-path'), 'warning', 1750);
            return;
        }
        console.info('Detecting subtitle language...');
        $('.tooltipped').tooltip('close');

        // spinner
        $('.detect-lang i').addClass('fa-circle-o-notch fa-spin').removeClass('fa-magic');

        detectLang(sub).then(function (data) {
            // app accepts down to 35% of probability for a lang, based on various tests with multiple lang subs
            if (data && data.probability > 35 && (data.iso6392 || data.bibliographic)) {
                $('#sublanguageid').val((data.iso6392 || data.bibliographic));
                console.info('Detected:', data.iso6392 || data.bibliographic);
            } else {
                console.error(data);
                throw 'not conclusive enough';
            }
            // hide spinner
            $('.detect-lang i').addClass('fa-magic').removeClass('fa-circle-o-notch fa-spin');
        }).catch(function (err) {
            // hide spinner
            $('.detect-lang i').addClass('fa-magic').removeClass('fa-circle-o-notch fa-spin');

            // notify
            Notify.snack(i18n.__('Language testing unconclusive, automatic detection failed'), 3800);
            console.error('Files.detectSubLang() error:', err);
        });
    },

    // AUTO: auto-detects if subtitle was translated by a machine
    detectMachineTranslated: function () {
        var sub = $('#subtitle-file-path').val();
        console.info('Detecting if subtitle was machine translated...');
        var filename = path.basename(sub);

        if ((filename.match(/auto/i) && filename.match(/translated/i)) || (filename.match(/babel/i) && filename.match(/fish/i)) || (filename.match(/google/i) && filename.match(/translate/i)) || (filename.match(/bing/i) && filename.match(/translation/i))) {
            // check if filename contains keywords
            console.info('Machine translation keywords detected in: subtitle name');
            $('#automatictranslation').prop('checked', true);
        } else {
            // check if content contains them
            fs.readFile(sub, function (err, data) {
                var content = data.toString();
                if ((content.match(/auto/i) && content.match(/translated/i)) || (content.match(/babel/i) && content.match(/fish/i)) || (content.match(/google/i) && content.match(/translate/i)) || (content.match(/bing/i) && content.match(/translation/i))) {
                    console.info('Machine translation keywords detected in: subtitle content');
                    $('#automatictranslation').prop('checked', true);
                }
            });
        }
    },

    // AUTO: spawn mediainfo binaries, grab info about video file and analyze them
    mediainfo: function (file) {
        return new Promise(function (resolve, reject) {
            var info = {};
            mi(file).then(function (md) {
                if (md && md[0]) {
                    console.info('MediaInfo data:', md[0]);

                    // do we have video track?
                    if (md[0].video) {
                        var video = md[0].video[0];
                        var tmp;

                        // duration
                        if (md[0].general.duration) {
                            tmp = md[0].general.duration[0].split(':');
                            if (tmp.length > 1) {
                                info.duration = tmp[0] * (1000 * 60 * 60) + tmp[1] * (1000 * 60) + tmp[2] * (1000);
                            } else {
                                info.duration = md[0].general.duration[0];
                            }
                        } else {
                            if (video.duration) {
                                tmp = video.duration[0].split(':');
                                if (tmp.length > 1) {
                                    info.duration = tmp[0] * (1000 * 60 * 60) + tmp[1] * (1000 * 60) + tmp[2] * (1000);
                                } else {
                                    info.duration = video.duration[0];
                                }
                            }
                        }

                        // total nb of frames
                        if (video.frame_count) {
                            info.frame_count = video.frame_count[0];
                        } else {
                            if (video.number_of_frames) {
                                info.frame_count = video.number_of_frames[0];
                            }
                        }

                        // height/width
                        if (video.height) {
                            info.height = video.height[0];
                        }
                        if (video.width) {
                            info.width = video.width[0];
                        }

                        // framerate
                        if (video.frame_rate) {
                            info.frame_rate = video.frame_rate[0];
                        } else {
                            if (video.original_frame_rate) {
                                info.frame_rate = video.original_frame_rate[0];
                            } else {
                                if (info.frame_count && info.duration) {
                                    tmp = (info.frame_count[0] / (info.duration[0] / 1000)).toFixed(3);
                                    if (tmp.match(/23\.9|24\.0|25\.0|29\.9|30\.0/)) {
                                        if (tmp.match(/23\.97/)) {
                                            info.frame_rate = '23.976';
                                        } else {
                                            info.frame_rate = tmp;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                resolve(info);
            }).catch(function (err) {
                // bypass error on mediainfo, it happens and isnt mandatory
                console.error('MediaInfo detection failed, continuing...', err);
                resolve(info);
            });
        });
    },
};