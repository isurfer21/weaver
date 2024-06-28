#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SUCCESS_SYMBOL = '✔';
const FAILURE_SYMBOL = '✘';

const TEMP_DIRNAME = '.cache';
const SLIDES_FILENAME = 'slides.csv'
const VIDEOS_FILENAME = 'videos.txt';
const VIDEO_FILENAME = 'video.mp4';
const AUDIOS_FILENAME = 'audios.txt';
const AUDIO_FILENAME = 'audio.m4a';
const CHUNK_FILENAME = 'chunks.csv';
const SEGMENT_FILENAME = 'segments.csv';
const OUTPUT_FILENAME = 'output.mp4';

class Sifter {
  static toArrayList(columns, rows) {
    let columnIds = Object.keys(columns);
    let columnTitles = Object.values(columns);
    let result = [columnTitles];
    for (let row of rows) {
      let rowValues = [];
      for (let columnId of columnIds) {
        rowValues.push(row[columnId]);
      }
      result.push(rowValues);
    }
    return result;
  }

  static toObjectList(columns, rows) {
    let columnIds = Object.keys(columns);
    let result = rows.map(row => {
      let rowObj = {};
      for (let columnId of columnIds) {
        let columnTitle = columns[columnId];
        rowObj[columnTitle] = row[columnId];
      }
      return rowObj;
    });
    return result;
  }
}

class AVEnviron {
  constructor() {
    this.dirCurr = process.cwd();
    this.dirTemp = path.join(this.dirCurr, TEMP_DIRNAME);
  }

  deleteTempDir() {
    if (fs.existsSync(this.dirTemp)) {
      fs.rmSync(this.dirTemp, { recursive: true });
    }
  }

  createTempDir() {
    if (!fs.existsSync(this.dirTemp)) {
      fs.mkdirSync(this.dirTemp);
    }
  }

  loadConfig(fileConfig) {
    if (!fileConfig) {
      throw Error(`The config file-path is missing, i.e., 'fileConfig' is undefined`);
      process.exit(1);
    }
    const data = fs.readFileSync(fileConfig, 'utf8');
    const lines = data.split(/\r?\n/);
    let columns = lines.shift().split(',');
    let rows = lines.flatMap(row => !!row ? [row.split(',')] : []);
    const config = Sifter.toObjectList(columns, rows);
    return config;
  }

  probeDuration(fileVideo) {
    const commandArgs = [
      '-i', fileVideo,
      '-v', 'error',
      '-show_entries',
      'format=duration',
      '-of',
      'json'
    ];
    const child = spawnSync('ffprobe', commandArgs);
    const stdout = child.stdout.toString();
    const duration = JSON.parse(stdout)?.format?.duration;
    return Number(duration);
  }
}

class CreateVideo extends AVEnviron {
  constructor() {
    super();
    this.createTempDir();
  }

  createVideo(fileSlide, fileAudio, timespan) {
    const fileVideo = path.join(this.dirTemp, OUTPUT_FILENAME);
    let commandArgs = [];

    if (fileAudio) {
      const duration = timespan || this.probeDuration(fileAudio);
      commandArgs = [
        '-i', fileAudio,
        '-loop', '1',
        '-i', fileSlide,
        '-t', duration,
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-pix_fmt', 'yuv420p',
        '-vb', '2000k',
        '-r', '25',
        '-f', 'mp4',
        '-ac', '2',
        '-ar', '44100',
        '-c:a', 'copy',
        '-b:a', '192k',
        '-shortest',
        fileVideo
      ];
    } else {
      commandArgs = [
        '-loop', '1',
        '-i', fileSlide,
        '-t', timespan,
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-pix_fmt', 'yuv420p',
        '-vb', '2000k',
        '-r', '25',
        '-f', 'mp4',
        '-c:a', 'copy',
        fileVideo
      ];
    }

    spawnSync('ffmpeg', commandArgs, { stdio: 'inherit' });
  }

  initialize(fileSlide, fileAudio, timespan) {
    if (!fileSlide) {
      console.log('Error: Slide image file-path is missing');
      process.exit(1);
    }
    if (!fileAudio && !timespan) {
      console.log('Error: Neither timespan of video nor audio is provided');
      process.exit(1);
    }
    if (fileAudio && !timespan) {
      console.log('Warning: Timespan is missing thus audio duration is considered as default timespan');
    }
    if (!fileAudio && timespan) {
      console.log('Warning: Audio file-path is missing thus video would be mute');
    }
    this.createVideo(fileSlide, fileAudio, timespan);
  }

  printHelp() {
    console.log(`
Options:
-h --help            display help menu
-s --slide=PNG       provide slide image file
-a --audio=M4A       provide audio file
-t --timespan=NUM    provide video file

Usages:
$ weaver create-video (-h|--help)
$ weaver create-video -s=PNG -a=M4A (-t=NUM)

Examples:
$ weaver create-video -h
$ weaver create-video -s=slide.png -a=${AUDIOS_FILENAME}
$ weaver create-video -s=slide.png -a=${AUDIOS_FILENAME} -t=400
$ weaver create-video -s=slide.png -t=400
    `);
  }
}

class CreateVideos extends AVEnviron {
  constructor() {
    super();
    this.createTempDir();
    this.fileVideosCatalog = path.join(this.dirTemp, VIDEOS_FILENAME);
  }

  createVideos() {
    let counter = 1, videos = [];
    for (const { slide, audio, duration } of this.dataConfig) {
      const fileVideo = path.join(this.dirTemp, `vid_${counter++}.mp4`);
      let commandArgs = [];

      if (audio) {
        commandArgs = [
          '-i', audio,
          '-loop', '1',
          '-i', slide,
          '-t', duration,
          '-c:v', 'libx264',
          '-tune', 'stillimage',
          '-pix_fmt', 'yuv420p',
          '-vb', '2000k',
          '-r', '25',
          '-f', 'mp4',
          '-ac', '2',
          '-ar', '44100',
          '-c:a', 'copy',
          '-b:a', '192k',
          '-shortest',
          fileVideo
        ];
      } else {
        commandArgs = [
          '-loop', '1',
          '-i', slide,
          '-t', duration,
          '-c:v', 'libx264',
          '-tune', 'stillimage',
          '-pix_fmt', 'yuv420p',
          '-vb', '2000k',
          '-r', '25',
          '-f', 'mp4',
          '-c:a', 'copy',
          fileVideo
        ];
      }

      videos.push(fileVideo);
      spawnSync('ffmpeg', commandArgs, { stdio: 'inherit' });
    }

    fs.writeFileSync(this.fileVideosCatalog, videos.map(fileVideo => `file '${path.basename(fileVideo)}'`).join('\n'));
  }

  initialize(fileConfig) {
    if (!fileConfig) {
      console.log('Error: Config file-path is missing');
      process.exit(1);
    }
    this.dataConfig = this.loadConfig(fileConfig);
    this.createVideos();
  }

  printHelp() {
    console.log(`
Options:
-h --help          display help menu
-c --config=CSV    provide configuration file

Usages:
$ weaver create-videos (-h|--help)
$ weaver create-videos -c=CSV

Examples:
$ weaver create-videos -h
$ weaver create-videos -c=${SLIDES_FILENAME}
    `);
  }
}

class UniteVideos extends AVEnviron {
  constructor() {
    super();
    this.createTempDir();
    this.fileVideosCatalog = path.join(this.dirTemp, VIDEOS_FILENAME);
  }

  uniteVideos() {
    const commandArgs = [
      '-f', 'concat',
      '-safe', '0',
      '-i', this.fileVideosCatalog,
      '-c', 'copy',
      path.join(this.dirTemp, OUTPUT_FILENAME)
    ];
    spawnSync('ffmpeg', commandArgs, { stdio: 'inherit' });
  }

  initialize(fileConfig) {
    if (!fileConfig) {
      console.log('Warning: Config file-path is missing');
    }
    if (!!fileConfig) {
      this.fileVideosCatalog = fileConfig;
    }
    this.uniteVideos();
  }

  printHelp() {
    console.log(`
Options:
  -h --help          display help menu
  -c --config=TXT    provide configuration file

Usages:
  $ weaver unite-videos (-h|--help)
  $ weaver unite-videos -c=TXT

Examples:
  $ weaver unite-videos -h
  $ weaver unite-videos -c=${VIDEOS_FILENAME}
    `);
  }
}

class SplitAudio extends AVEnviron {
  constructor() {
    super();
    this.createTempDir();
    this.fileAudiosCatalog = path.join(this.dirTemp, AUDIOS_FILENAME);
  }

  splitAudio(fileAudio) {
    let timestamps = this.dataConfig.map(({ timestamp }) => timestamp);

    if (timestamps.length < 2) {
      throw Error('There should be atleast 2 or more timestamps.');
      process.exit(1);
    }

    for (let i = 0; i < timestamps.length; i++) {
      let commandArgs = [
        '-i', fileAudio,
        '-ss', timestamps[i - 1] || 0,
        '-to', timestamps[i],
        '-c', 'copy',
        path.join(this.dirTemp, `aud-${i + 1}.m4a`)
      ];
      spawnSync('ffmpeg', commandArgs, { stdio: 'inherit' });
    }
  }

  initialize(fileConfig, fileAudio) {
    if (!fileConfig) {
      console.log('Error: Config file-path is missing');
      process.exit(1);
    }
    if (!fileAudio) {
      console.log('Error: Audio file-path is missing');
      process.exit(1);
    }
    this.dataConfig = this.loadConfig(fileConfig);
    this.splitAudio(fileAudio);
  }

  printHelp() {
    console.log(`
Options:
  -h --help          display help menu
  -c --config=CSV    provide configuration file
  -a --audio=M4A    provide raw audio file

Usages:
  $ weaver split-audio (-h|--help)
  $ weaver split-audio -c=CSV

Examples:
  $ weaver split-audio -h
  $ weaver split-audio -c=chunks.csv -a=audio.m4a
    `);
  }
}

class MergeAV extends AVEnviron {
  constructor() {
    super();
    this.createTempDir();
  }

  mergeAV(fileAudio, fileVideo) {
    let commandArgs = [
      '-i', fileVideo,
      '-i', fileAudio,
      '-map', '0:v',
      '-map', '1:a',
      '-c:v', 'copy',
      '-c:a', 'copy',
      path.join(this.dirTemp, OUTPUT_FILENAME)
    ];

    spawnSync('ffmpeg', commandArgs, { stdio: 'inherit' });
  }

  initialize(fileAudio, fileVideo) {
    if (!fileAudio) {
      console.log('Error: Audio file-path is missing');
      process.exit(1);
    }
    if (!fileVideo) {
      console.log('Error: Video file-path is missing');
      process.exit(1);
    }
    this.mergeAV(fileAudio, fileVideo);
  }

  printHelp() {
    console.log(`
Options:
  -h --help          display help menu
  -a --audio=M4A     provide raw audio file
  -v --video=MP4     provide raw video file

Usages:
  $ weaver merge-av (-h|--help)
  $ weaver merge-av -c=CSV

Examples:
  $ weaver merge-av -h
  $ weaver merge-av -a=${AUDIO_FILENAME} -v=${VIDEO_FILENAME}
    `);
  }
}

class RemoveSegment extends AVEnviron {
  constructor() {
    super();
    this.createTempDir();
  }

  removeSegment(fileVideo, tsSegmentBegin, tsSegmentEnd) {
    const segmentBefore = {
      begin: 0,
      end: tsSegmentBegin
    };
    const segmentAfter = {
      begin: tsSegmentEnd,
      end: this.probeDuration(fileVideo)
    };
    const commandArgs = [
      '-i', fileVideo,
      '-filter_complex',
      `[0:v]trim=start=${segmentBefore.begin}:end=${segmentBefore.end},setpts=PTS-STARTPTS[v1]; [0:v]trim=start=${segmentAfter.begin}:end=${segmentAfter.end},setpts=PTS-STARTPTS[v2]; [0:a]atrim=start=${segmentBefore.begin}:end=${segmentBefore.end},asetpts=PTS-STARTPTS[a1]; [0:a]atrim=start=${segmentAfter.begin}:end=${segmentAfter.end},asetpts=PTS-STARTPTS[a2]; [v1][a1][v2][a2]concat=n=2:v=1:a=1[out]`,
      '-map', '[out]',
      path.join(this.dirTemp, OUTPUT_FILENAME)
    ];
    spawnSync('ffmpeg', commandArgs, { stdio: 'inherit' });
  }

  initialize(fileVideo, tsSegmentBegin, tsSegmentEnd) {
    if (!fileVideo) {
      console.log('Error: Video file-path is missing');
      process.exit(1);
    }
    if (!tsSegmentBegin) {
      console.log('Error: Video segment begin timestamp is missing');
      process.exit(1);
    }
    if (!tsSegmentEnd) {
      console.log('Error: Video segment end timestamp is missing');
      process.exit(1);
    }
    this.removeSegment(fileVideo, tsSegmentBegin, tsSegmentEnd);
  }

  printHelp() {
    console.log(`
Options:
  -h --help            display help menu
  -v --video=MP4       provide raw video file
  -b --begin=SEC       provide begin time of segment
  -e --end=SEC         provide end time of segment

Usages:
  $ weaver remove-segment (-h|--help)
  $ weaver remove-segment -v=MP4 -b=SEC -e=SEC

Examples:
  $ weaver remove-segment -h
  $ weaver remove-segment -v=${VIDEO_FILENAME} -b=100 -e=200
    `);
  }
}

class RemoveSegments extends AVEnviron {
  constructor() {
    super();
    this.createTempDir();
  }

  removeSegments(fileVideo) {
    let betweenChunks = [],
      duration = this.probeDuration(fileVideo);

    for (let i = 0; i < this.dataConfig.length; i++) {
      const begin = (i > 0) ? Number(this.dataConfig[i - 1]?.end) + 0.9 : 0,
        end = (i < this.dataConfig.length - 1) ? Number(this.dataConfig[i]?.begin - 0.1) : duration;
      betweenChunks.push(`between(t,${begin},${end})`)
    }

    const selectQuery = betweenChunks.join('+');
    const commandArgs = [
      '-i', fileVideo,
      '-vf', `select='${selectQuery}',setpts=N/FRAME_RATE/TB`,
      '-af', `aselect='${selectQuery}',asetpts=N/SR/TB`,
      path.join(this.dirTemp, OUTPUT_FILENAME)
    ];

    // spawnSync('ffmpeg', commandArgs, { stdio: 'inherit' });
  }

  initialize(fileConfig, fileVideo) {
    if (!fileConfig) {
      console.log('Error: Config file-path is missing');
      process.exit(1);
    }
    if (!fileVideo) {
      console.log('Error: Video file-path is missing');
      process.exit(1);
    }
    this.dataConfig = this.loadConfig(fileConfig);
    this.removeSegments(fileVideo);
  }

  printHelp() {
    console.log(`
Options:
  -h --help            display help menu
  -c --config=CSV      provide configuration file
  -v --video=MP4       provide raw video file

Usages:
  $ weaver remove-segments (-h|--help)
  $ weaver remove-segments -c=CSV -v=MP4

Examples:
  $ weaver remove-segments -h
  $ weaver remove-segments -c=${SEGMENT_FILENAME} -v=${VIDEO_FILENAME}
    `);
  }
}

class ClipSegments extends AVEnviron {
  constructor() {
    super();
    this.createTempDir();
  }

  clipSegments(fileVideo) {
    let betweenChunks = [];
    for (const { begin, end } of this.dataConfig) {
      betweenChunks.push(`between(t,${begin},${end})`)
    }
    const selectQuery = betweenChunks.join('+');
    const commandArgs = [
      '-i', fileVideo,
      '-vf', `select='${selectQuery}',setpts=N/FRAME_RATE/TB`,
      '-af', `aselect='${selectQuery}',asetpts=N/SR/TB`,
      path.join(this.dirTemp, OUTPUT_FILENAME)
    ];
    spawnSync('ffmpeg', commandArgs, { stdio: 'inherit' });
  }

  initialize(fileConfig, fileVideo) {
    if (!fileConfig) {
      console.log('Error: Config file-path is missing');
      process.exit(1);
    }
    if (!fileVideo) {
      console.log('Error: Video file-path is missing');
      process.exit(1);
    }
    this.dataConfig = this.loadConfig(fileConfig);
    this.clipSegments(fileVideo);
  }

  printHelp() {
    console.log(`
Options:
  -h --help            display help menu
  -c --config=CSV      provide configuration file
  -v --video=MP4       provide raw video file

Usages:
  $ weaver clip-segments (-h|--help)
  $ weaver clip-segments -c=CSV -v=MP4

Examples:
  $ weaver clip-segments -h
  $ weaver clip-segments -c=${SEGMENT_FILENAME} -v=${VIDEO_FILENAME}
    `);
  }
}

class SelfTest extends AVEnviron {
  constructor() {
    super();
    this.createTempDir();
    this.isAbort = false;
  }

  test__AVEnviron_createTempDir() {
    this.createTempDir();
    if (fs.existsSync(this.dirTemp)) {
      console.log('- createTempDir:', SUCCESS_SYMBOL);
    } else {
      console.log('- createTempDir:', FAILURE_SYMBOL);
      this.isAbort = true;
    }
  }

  test__AVEnviron_loadConfig() {
    this.dataConfig = this.loadConfig(this.fileConfig);
    if (Array.isArray(this.dataConfig) && this.dataConfig.length > 0 && typeof this.dataConfig[0] === 'object') {
      console.log('- loadConfig:', SUCCESS_SYMBOL);
    } else {
      console.log('- loadConfig:', FAILURE_SYMBOL);
      this.isAbort = true;
    }
  }

  initialize(fileConfig) {
    if (!fileConfig) {
      console.log('Error: Config file-path is missing');
      process.exit(1);
    }
    this.fileConfig = fileConfig;

    console.log('AVEnviron');
    !this.isAbort && this.test__AVEnviron_createTempDir();
    !this.isAbort && this.test__AVEnviron_loadConfig();
  }

  printHelp() {
    console.log(`
Options:
  -h --help          display help menu
  -c --config=CSV    provide configuration file

Usages:
  $ weaver self-test (-h|--help)
  $ weaver self-test -c=CSV

Examples:
  $ weaver self-test -h
  $ weaver self-test -c=slides.csv
    `);
  }
}

class CLI {
  constructor() {
    this.argv = this.argvParse();
  }

  argvParse() {
    const flags = { _: [] };
    process.argv.forEach((s, e) => {
      if (e >= 2)
        if (/^[\-\-]{1,2}.+[\=\:].*$/.test(s)) {
          let e = s.split(/[\=\:]/),
            l = e[0].lastIndexOf("-");
          l < 2 && (flags[e[0].substring(l + 1)] = e[1]);
        } else if (/^[\-\-]{1,2}.+$/.test(s)) {
          let e = s.lastIndexOf("-");
          e < 2 && (flags[s.substring(e + 1)] = !0);
        } else flags._.push(s);
    });
    return flags;
  }

  printHelp() {
    console.log(`
Options:
  -h --help          display help menu
  -v --version       show app version
  -c --clean         clean up temporary directory 

Commands:
  create-video       create video from image and audio
  create-videos      create video chunks from image and audio
  unite-videos       unite video chunks
  split-audio        split audio into chunks
  merge-av           merge audio into video
  remove-segment     remove segment from video
  remove-segments    remove segments from video
  clip-segments      clip segments from video

Troubleshoot:
  self-test          self-test built-in methods

Usages:
  $ weaver (-h|--help)
  $ weaver (-v|--version)

Examples:
  $ weaver --help
  $ weaver --clean
  $ weaver create-video --help
  $ weaver create-videos --help
  $ weaver unite-videos --help
  $ weaver split-audio --help
  $ weaver merge-av --help
  $ weaver remove-segment --help
  $ weaver remove-segments --help
  $ weaver clip-segments --help
  $ weaver self-test --help
    `);
  }

  process() {
    if (this.argv._.length == 0) {
      if (this.argv.h || this.argv.help) {
        this.printHelp();
      } else if (this.argv.v || this.argv.version) {
        console.log(`Weaver   version 1.0.0`);
      } else if (this.argv.c || this.argv.clean) {
        const avEnviron = new AVEnviron();
        avEnviron.deleteTempDir();
      } else {
        console.log('Error: Command is missing');
      }
    } else {
      const command = this.argv._[0];
      switch (command) {
        case 'create-video':
          const createVideo = new CreateVideo();
          if (this.argv.h || this.argv.help) {
            createVideo.printHelp();
          } else {
            const fileSlide = this.argv.s || this.argv.slide;
            const fileAudio = this.argv.a || this.argv.audio;
            const timespan = this.argv.t || this.argv.timespan;
            createVideo.initialize(fileSlide, fileAudio, timespan);
          }
          break;
        case 'create-videos':
          const createVideos = new CreateVideos();
          if (this.argv.h || this.argv.help) {
            createVideos.printHelp();
          } else {
            const fileConfig = this.argv.c || this.argv.config;
            createVideos.initialize(fileConfig);
          }
          break;
        case 'unite-videos':
          const uniteVideos = new UniteVideos();
          if (this.argv.h || this.argv.help) {
            uniteVideos.printHelp();
          } else {
            const fileConfig = this.argv.c || this.argv.config;
            uniteVideos.initialize(fileConfig)
          }
          break;
        case 'split-audio':
          const splitAudio = new SplitAudio();
          if (this.argv.h || this.argv.help) {
            splitAudio.printHelp();
          } else {
            const fileConfig = this.argv.c || this.argv.config;
            const fileAudio = this.argv.a || this.argv.audio;
            splitAudio.initialize(fileConfig, fileAudio);
          }
          break;
        case 'merge-av':
          const mergeAV = new MergeAV();
          if (this.argv.h || this.argv.help) {
            mergeAV.printHelp();
          } else {
            const fileAudio = this.argv.a || this.argv.audio;
            const fileVideo = this.argv.v || this.argv.video;
            mergeAV.initialize(fileAudio, fileVideo);
          }
          break;
        case 'remove-segment':
          const removeSegment = new RemoveSegment();
          if (this.argv.h || this.argv.help) {
            removeSegment.printHelp();
          } else {
            const fileVideo = this.argv.v || this.argv.video;
            const beginSegment = this.argv.b || this.argv.begin;
            const endSegment = this.argv.e || this.argv.end;
            removeSegment.initialize(fileVideo, beginSegment, endSegment);
          }
          break;
        case 'remove-segments':
          const removeSegments = new RemoveSegments();
          if (this.argv.h || this.argv.help) {
            removeSegments.printHelp();
          } else {
            const fileConfig = this.argv.c || this.argv.config;
            const fileVideo = this.argv.v || this.argv.video;
            removeSegments.initialize(fileConfig, fileVideo);
          }
          break;
        case 'clip-segments':
          const clipSegments = new ClipSegments();
          if (this.argv.h || this.argv.help) {
            clipSegments.printHelp();
          } else {
            const fileConfig = this.argv.c || this.argv.config;
            const fileVideo = this.argv.v || this.argv.video;
            clipSegments.initialize(fileConfig, fileVideo);
          }
          break;
        case 'self-test':
          const selfTest = new SelfTest();
          if (this.argv.h || this.argv.help) {
            selfTest.printHelp();
          } else {
            const fileConfig = this.argv.c || this.argv.config;
            selfTest.initialize(fileConfig);
          }
          break;
        default:
          console.log(`Error: '${command}' command is invalid`)
      }
    }
  }
}

const cli = new CLI();
cli.process();
