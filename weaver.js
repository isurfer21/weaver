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
    const lines = data.split('\n');
    let columns = lines.shift().split(',');
    let rows = lines.flatMap(row => !!row ? [row.split(',')] : []);
    const config = Sifter.toObjectList(columns, rows);
    return config;
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
    this.dataConfig = this.loadConfig(fileConfig);
    this.createVideos();
  }

  printHelp() {
    console.log(`
Options:
-h --help          display help menu
-c --config=CSV    provide configuration file

Usages:
$ node weaver.js create-videos (-h|--help)
$ node weaver.js create-videos -c=CSV

Examples:
$ node weaver.js create-videos -h
$ node weaver.js create-videos -c=${SLIDES_FILENAME}
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
  $ node weaver.js unite-videos (-h|--help)
  $ node weaver.js unite-videos -c=TXT

Examples:
  $ node weaver.js unite-videos -h
  $ node weaver.js unite-videos -c=${VIDEOS_FILENAME}
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
    let timestamps = this.dataConfig.map(({ timestamp }) => timestamp).join(',');

    let commandArgs = [
      '-i', fileAudio,
      '-f', 'segment',
      '-segment_times', timestamps,
      '-c', 'copy',
      '-ac', '2',
      path.join(this.dirTemp, `aud-%3d.m4a`)
    ];

    spawnSync('ffmpeg', commandArgs, { stdio: 'inherit' });
  }

  initialize(fileConfig, fileAudio) {
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
  $ node weaver.js split-audio (-h|--help)
  $ node weaver.js split-audio -c=CSV

Examples:
  $ node weaver.js split-audio -h
  $ node weaver.js split-audio -c=chunks.csv -a=audio.m4a
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
    this.mergeAV(fileAudio, fileVideo);
  }

  printHelp() {
    console.log(`
Options:
  -h --help          display help menu
  -a --audio=M4A    provide raw audio file
  -v --video=MP4    provide raw video file

Usages:
  $ node weaver.js merge-av (-h|--help)
  $ node weaver.js merge-av -c=CSV

Examples:
  $ node weaver.js merge-av -h
  $ node weaver.js merge-av -a=${AUDIO_FILENAME} -v=${VIDEO_FILENAME}
    `);
  }
}

class RemoveSegment extends AVEnviron {
  constructor() {
    super();
    this.createTempDir();
  }

  probeDuration(fileVideo) {
    const commandArgs = [
      '-i', fileVideo, 
      '-v', 'quiet', 
      '-show_entries', 'format=duration'
    ];
    const child = spawnSync('ffmpeg', commandArgs, { stdio: 'inherit' });
    const stdout = child.stdout.split('\n');
    const duration = stdout[1].split('=')[1];
    return duration;
  }

  removeSegment(fileVideo, tsSegmentBegin, tsSegmentEnd) {
    const segmentBefore = {
      begin: 0,
      end: tsSegmentBegin
    };
    const segmentAfter = {
      begin: tsSegmentEnd,
      end: probeDuration(fileVideo)
    };
    const commandArgs = [
      '-i', fileVideo,
      '-filter_complex',
      `"[0:v]trim=start=${segmentBefore.begin}:end=${segmentBefore.end},setpts=PTS-STARTPTS[v1];`,
      `[0:v]trim=start=${segmentAfter.begin}:end=${segmentAfter.end},setpts=PTS-STARTPTS[v2];`,
      `[0:a]atrim=start=${segmentBefore.begin}:end=${segmentBefore.end},asetpts=PTS-STARTPTS[a1];`,
      `[0:a]atrim=start=${segmentAfter.begin}:end=${segmentAfter.end},asetpts=PTS-STARTPTS[a2];`,
      `[v1][a1][v2][a2]concat=n=2:v=1:a=1[out]"`,
      '-map', '[out]',
      path.join(this.dirTemp, OUTPUT_FILENAME)
    ];
    spawnSync('ffmpeg', commandArgs, { stdio: 'inherit' });
  }

  initialize(fileVideo, tsSegmentBegin, tsSegmentEnd) {
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
  $ node weaver.js remove-segment (-h|--help)
  $ node weaver.js remove-segment -v=MP4 -b=SEC -e=SEC

Examples:
  $ node weaver.js remove-segment -h
  $ node weaver.js remove-segment -v=${VIDEO_FILENAME} -b=100 -e=200
    `);
  }
}

class RemoveSegments extends RemoveSegment {
  constructor() {
    super();
    this.createTempDir();
  }

  removeSegments(fileVideo) {
    let betweenChunks = [];
    for (const { begin, end } of this.dataConfig) {
      betweenChunks.push(`between(t,${begin},${end})`)
    }
    const selectQuery = betweenChunks.join('+');
    const commandArgs = [
      '-i', fileVideo,
      '-vf', `"select='${selectQuery}',setpts=N/FRAME_RATE/TB"`,
      '-af', `"aselect='${selectQuery}',asetpts=N/SR/TB"`,
      path.join(this.dirTemp, OUTPUT_FILENAME)
    ];
    spawnSync('ffmpeg', commandArgs, { stdio: 'inherit' });
  }

  initialize(fileConfig, fileVideo) {
    this.dataConfig = this.loadConfig(fileConfig);
    this.removeSegments(fileVideo);
  }

  printHelp_RemoveSegments() {
    console.log(`
Options:
  -h --help            display help menu
  -c --config=CSV      provide configuration file
  -v --video=MP4       provide raw video file

Usages:
  $ node weaver.js remove-segments (-h|--help)
  $ node weaver.js remove-segments -c=CSV -v=MP4

Examples:
  $ node weaver.js remove-segments -h
  $ node weaver.js remove-segments -c=${SEGMENT_FILENAME} -v=${VIDEO_FILENAME}
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
  $ node weaver.js self-test (-h|--help)
  $ node weaver.js self-test -c=CSV

Examples:
  $ node weaver.js self-test -h
  $ node weaver.js self-test -c=slides.csv
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
  create-videos      create video chunks from image and audio
  unite-videos       unite video chunks
  split-audio        split audio into chunks
  merge-audio        merge audio into video
  remove-segment     remove segment from video
  remove-segments    remove segments from video

Troubleshoot:
  self-test          self-test built-in methods

Usages:
  $ node weaver.js (-h|--help)
  $ node weaver.js (-v|--version)

Examples:
  $ node weaver.js --help
  $ node weaver.js --clean
  $ node weaver.js create-videos --help
  $ node weaver.js unite-videos --help
  $ node weaver.js split-audio --help
  $ node weaver.js merge-audio --help
  $ node weaver.js remove-segment --help
  $ node weaver.js remove-segments --help
  $ node weaver.js self-test --help
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
        case 'create-videos':
          const createVideos = new CreateVideos();
          if (this.argv.h || this.argv.help) {
            createVideos.printHelp();
          } else {
            const fileConfig = this.argv.c || this.argv.config || SLIDES_FILENAME;
            createVideos.initialize(fileConfig);
          }
          break;
        case 'unite-videos':
          const uniteVideos = new UniteVideos();
          if (this.argv.h || this.argv.help) {
            uniteVideos.printHelp();
          } else {
            const fileConfig = this.argv.c || this.argv.config || VIDEOS_FILENAME;
            uniteVideos.initialize(fileConfig)
          }
          break;
        case 'split-audio':
          const splitAudio = new SplitAudio();
          if (this.argv.h || this.argv.help) {
            splitAudio.printHelp();
          } else {
            const fileConfig = this.argv.c || this.argv.config || SLIDES_FILENAME;
            const fileAudio = this.argv.a || this.argv.audio || AUDIO_FILENAME;
            splitAudio.initialize(fileConfig, fileAudio);
          }
          break;
        case 'merge-av':
          const mergeAV = new MergeAV();
          if (this.argv.h || this.argv.help) {
            this.printHelp();
          } else {
            const fileAudio = this.argv.a || this.argv.audio || AUDIO_FILENAME;
            const fileVideo = this.argv.v || this.argv.video || VIDEO_FILENAME;
            mergeAV.initialize(fileAudio, fileVideo);
          }
          break;
        case 'remove-segment':
          const removeSegment = new RemoveSegment();
          if (this.argv.h || this.argv.help) {
            this.printHelp();
          } else {
            const fileVideo = this.argv.v || this.argv.video || VIDEO_FILENAME;
            const beginSegment = this.argv.b || this.argv.begin;
            const endSegment = this.argv.e || this.argv.end;
            removeSegment.initialize(fileVideo, beginSegment, endSegment);
          }
          break;
        case 'remove-segments':
          const removeSegments = new RemoveSegments();
          if (this.argv.h || this.argv.help) {
            this.printHelp();
          } else {
            const fileConfig = this.argv.c || this.argv.config || SEGMENT_FILENAME;
            const fileVideo = this.argv.v || this.argv.video || VIDEO_FILENAME;
            removeSegments.initialize(fileConfig, fileVideo);
          }
          break;
        case 'self-test':
          const selfTest = new SelfTest();
          if (this.argv.h || this.argv.help) {
            selfTest.printHelp();
          } else {
            const fileConfig = this.argv.c || this.argv.config || SLIDES_FILENAME;
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
