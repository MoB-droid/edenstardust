# Editor map

Built by `build.py` on every build: do not edit by hand. Read this first, then open only the part you need.

- The parts are joined in this order into one page (`plan.html` on the site, the Seat Plan artifact as preview).
- Parts 01 to 09 are complete on their own (plan reading: desks, chairs, OSH, elements). The tests load them.
- Parts 10 to 20 (`*-main-*`) are pieces of the one `MAIN` function (the page's behaviour): they share its variables.

| # | Part | Lines | Holds | Functions |
|---|------|-------|-------|-----------|
| 1 | `head.html` | 3 | page title, fonts |  |
| 2 | `style.css` | 460 | all the editor styling |  |
| 3 | `body.html` | 70 | the page markup: plan frame, PROGRAM and ANALYSIS tables, buttons, dialogs |  |
| 4 | `js/01-layout-data.js` | 158 | EMBED (the empty start layout), team colours, marker scale, chairs, renderLayout (draws the plan) | teamColor, paintColor, scaleMarkers, lnote, xesc, f1, sideOf, chairsFor, fr, renderLayout |
| 5 | `js/02-flags.js` | 116 | Red flags (set by the user 24 Nov 2026) | flagsKey, flagsShown, flagLines, drawFlags, ok, onDesk, cross, boxAt, hit, pickLayout, watchPlan |
| 6 | `js/03-milestones.js` | 186 | Milestones (set by the user 19 Nov 2026) | msCol, msDb, msLoaded, msShow, msForTabs, norm, generic, msLoad, msToday, msSave, msGo, msAdd, msEdit, fin, msDrag, mv, up, msNudge, msRender, START |
| 7 | `js/04-pdf-desks.js` | 113 | Automatic analysis of an uploaded PDF: read its drawing lines, find the desks, group them into teams | loadScript, loadPdf, pdfSegments, findDesks, uniq, index, scan, corners, sq, ov |
| 8 | `js/05-scale.js` | 136 | Any drawing scale and desk size | sizeLabels, sameSize, addSizes, scaleVotes, index, near, run, tilts, frameSegs, readDesks |
| 9 | `js/06-chairs.js` | 148 | Chairs mark desk centres (set by the user 24 Nov 2026) | findChairs, root, key, pr, idx, lines, deskOf, build, chairDesks, area, ovl |
| 10 | `js/07-osh.js` | 353 | OSH = open space hidden (rules C2 23-25, set by the user 24 Nov 2026) | pdfInk, oshGrid, draw, touches, near, onLine, seed, deskFrame, oshFeatures, root, cell, cast, oshDecide, root, hit, oshFromPage, oshFlags, seatRange, backfillOsh |
| 11 | `js/08-elements.js` | 658 | C3 element inventory (set by the user 25 Nov 2026, version 1) | elRead, elArc, elSpaces, plain, aroundText, dimLine, elLabels, elTags, elKind, elInventory, inB, zone, ctr, ub, grow, out, zones, put, nd, ok, at, closed, lab, tagsOf, tb, room, room2, rk, rname, rloc, tagRow, rt0, elSwings, fit, key, elBoxed, elOfPage, backfillElements, buildLayout, f, planPicture |
| 12 | `js/09-shell.js` | 178 | The building's shell and core, read from the plan picture, for placing team markers | buildingShell, backfillShell, clearOldSeating |
| 13 | `js/10-main-view.js` | 108 | MAIN starts here: zoom, fit, pan, row and desk highlight | MAIN, fitWidth, applyZoom, fitTotals, alignTotalsTop, alignProgram, deskOfRow, rowOfDesk, hi, endPan |
| 14 | `js/11-main-edit-save.js` | 286 | drag a person, desk click, undo history, painting names and totals, save to the database, shading | dropDeskAt, deskClick, setOpen, keepHist, batch, pushStep, clone, cap, paint, paintEds, paintDeskNames, paintTeamNames, paintFlags, paintTotal, showErr, save, paintShade, shade, shadeTeam |
| 15 | `js/12-main-teams-markers.js` | 522 | teams: moving, added teams, seat types (single, OSH), flag answers, team markers and where they may stand | moveOf, ctr, needOf, addedIds, esc, personRow, syncAdded, pruneBenches, benchFill, isSingleDesk, rowSingle, isOshDesk, rowHidden, autoType, answerFlag, placeFlagTog, captureKinds, markerBase, leadBase, setLabels, resetMarker, placeOutside, fitView, readShell, paintFloor, paintOutlines, cellAt, nearDesk, inCore, spacesOf, walkOut, shellSpot, spreadMarkers, svgBox, hitsBuilding, hitsBox, clearMarkers |
| 16 | `js/13-main-parked-relayout.js` | 366 | parked markers of unseated teams, relayout (redraws everything after a change), seat summary per type | loadInk, parkMarkers, relayout, paintTyHi, renderSummary |
| 17 | `js/14-main-analysis.js` | 180 | ANALYSIS table (C3 element inventory), marker dragging, writing seats, moves and types to the database | anRows, anDraw, anRender, anPick, svgPt, saveMove, endDrag, saveGone, saveDeleted, placeConfirm, closeConfirm, writePseat, writePkind, writePtype, writeAssign, writeMove |
| 18 | `js/15-main-suggest.js` | 202 | Suggest: seats every team following the rules | suggest |
| 19 | `js/16-main-export.js` | 181 | Download layout (PNG picture with header) and Download program (Excel / CSV) | closeExp, fileBase, offerFile, downloadFile, nextOption, logoData, planImage, rrect, makeLayoutPicture, programRows, makeProgramCsv, makeProgramXlsx, deliverMany |
| 20 | `js/17-main-title-upload.js` | 102 | layout title, Upload layout, Delete program, CSV and Excel file loading | paintTitle, saveTitle, layNote, parseCSV, loadXLSX |
| 21 | `js/18-main-program-read.js` | 342 | reading a program table (columns, types), Upload program, HR seating files (rules D4), messy-table message | isNum, kindOf, mapColumns, normType, readSheets, filled, sheetText, aiPrompt, aiRead, columnRead, hrCell, hrType, hrHeader, hrRead, progNote, addProgram, isMessy, showMessy, readProgram |
| 22 | `js/19-main-sheet.js` | 189 | Google Sheet as the program (Link sheet, Update), sheet tabs = milestones | paintSheet, onSite, googleReady, googleToken, gfetch, sheetTables, sheetError, saveSheetMeta, syncProgram, programTabs, loadTabs, updateFromSheet, pickSheet, closeSheetMenu |
| 23 | `js/20-main-downloads-drop.js` | 268 | download destinations (device / Google Drive), drag and drop of files, MAIN ends, START() | destOf, onDrive, paintDest, saveDest, tapToShare, sendNow, pickFolder, lastFolder, dropKind, hasFiles, dropMark, clearDrop, saveAdded |
