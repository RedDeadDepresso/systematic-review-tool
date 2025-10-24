# Systematic Review Tool

## Prerequisites

[Docker](https://docs.docker.com/get-started/get-docker/)

## Getting Started

```
docker compose -f "docker-compose-dev.yml" up --build
```

Website will be acccessible at http://localhost:3000.

## Overview

The aim of this project is to build a systematic literature review (SLR) tool that will help researchers to synthesise results on a specific research question from multiple academic research studies. The tool needs to create new SLR projects, and for each project to import sets of references in BibTex format, automatically remove duplicates, allow sets of papers to be allocated to different reviewers for screening, allow reviewers to code and theme included papers and pull out relevant results.

Systematic literature reviews select and evaluate published research studies in order to answer a clearly formulated question, and systematic mapping studies select and evaluate published research studies in order to identify the state-of-the-art in a particular research area. Both approaches require researchers to systematically search for relevant published papers and to screen papers in order to arrive at a final set of relevant articles. For SLRs analysis involves identifying and synthesizing results from the chosen set of papers, for SMSs analysis involves coding and theming the chosen set of papers. The process needs to be well-defined, well-documented and repeatable. Tools can be very useful to help research teams to manage the process. Although tools are available (i.e. Rayyan), their interfaces are poor and they are not well-designed for mapping reviews or coding/theming.
