# weaver

Weaver is a command-line tool that allows you to manipulate video and audio files in various ways. You can create video chunks from image and audio, unite video chunks, split audio into chunks, merge audio into video, remove segment from video, remove segments from video, and clip segments from video.

## Installation

To install Weaver, you need to have [node.js](https://nodejs.org/) installed on your system. Then, you can run the following command:

```bash
npm install weaver
```

## Usage

To use Weaver, you need to invoke the `weaver` command with the appropriate options and arguments. You can also use the `--help` option to display the help menu for the main command or any subcommand.

The general syntax is:

```bash
weaver [options] [command] [arguments]
```

The available options are:

- `-h` or `--help`: display the help menu
- `-v` or `--version`: show the app version
- `-c` or `--clean`: clean up the temporary directory

The available commands are:

- `create-video`: create video from image and audio
- `create-videos`: create video chunks from image and audio
- `unite-videos`: unite video chunks
- `split-audio`: split audio into chunks
- `merge-av`: merge audio into video
- `remove-segment`: remove segment from video
- `remove-segments`: remove segments from video
- `clip-segments`: clip segments from video
- `self-test`: self-test built-in methods

Each command has its own options and arguments, which you can see by using the `--help` option with the command name. For example, to see the help menu for the `create-videos` command, you can run:

```bash
weaver create-videos --help
```

## Examples

Here are some examples of how to use Weaver for different tasks:

- To create video from image and audio, you can run:

```bash
weaver create-video -s=image.png -a=audio.m4a -t=400
```

This will create video named `output.mp4` in the temporary directory, using the image `image.png` and the audio `audio.mp3`.

- To create video chunks from image and audio, you can run:

```bash
weaver create-videos -c=slides.csv
```

This will create video chunks named `vid_1.mp4`, `vid_2.mp4`, etc. in the temporary directory, using the image and the audio file path given in the `slides.csv` file.

- To unite video chunks, you can run:

```bash
weaver unite-videos -c=videos.txt
```

This will unite all the video chunks that match the pattern `output_*.mp4` and create a single video file named `final.mp4` in the temporary directory.

- To split audio into chunks, you can run:

```bash
weaver split-audio -c=chunks.csv -a=audio.m4a
```

This will split the audio `audio.m4a` into chunks of 10 seconds each and create audio files named `aud-1.m4a`, `aud-2.m4a`, etc. in the temporary directory.

- To merge audio into video, you can run:

```bash
weaver merge-av -a=audio.m4a -v=video.mp4
```

This will merge the audio `audio.m4a` into the video `video.mp4` and create a new video file named `output.mp4` in the temporary directory.

- To remove a segment from a video, you can run:

```bash
weaver remove-segment -v=video.mp4 -b=100 -e=200
```

This will remove the segment, say from 100 seconds to 200 seconds from the video `video.mp4` and create a new video file named `output.mp4` in the temporary directory.

- To remove multiple segments from a video, you can run:

```bash
weaver remove-segments -c=segments.csv -v=video.mp4
```

This will remove the segments, say from 30 seconds to 60 seconds and from 90 seconds to 120 seconds from the video `video.mp4` and create a new video file named `output.mp4` in the temporary directory.

- To clip multiple segments from a video, you can run:

```bash
weaver clip-segments -c=segments.csv -v=video.mp4
```

This will clip the segments, say from 30 seconds to 60 seconds and from 90 seconds to 120 seconds from the video `video.mp4` as specified in `segments.csv` file and create video file named `output.mp4` by consolidating all the segments in the temporary directory.

- To self-test the built-in methods, you can run:

```bash
weaver self-test
```

This will run a series of tests on the built-in methods and display the results.

## Troubleshoot

If you encounter any problems or errors while using Weaver, you can use the `--help` option to see the usage and options for each command. You can also use the `self-test` command to check if the built-in methods are working properly. If you still need help, log it in [issues](https://github.com/isurfer21/weaver/issues) section.