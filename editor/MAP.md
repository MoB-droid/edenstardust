# Editor map

Built by `build.py` on every build: do not edit by hand. Read this first, then open only the part you need.

- The parts are joined in this order into one page (`plan.html` on the site, the Seat Plan artifact as preview).
- Parts 01 to 09 are complete on their own (drawing the plan, flags, milestones, reading a PDF page).
- The rules are not in this repo: the page asks the server (`brain(op, …)` in `js/04-pdf-read.js`).
- Parts 10 to 20 (`*-main-*`) are pieces of the one `MAIN` function (the page's behaviour): they share its variables.

| # | Part | Lines | Holds | Functions |
|---|------|-------|-------|-----------|
| 1 | `head.html` | 3 | page title, fonts |  |
| 2 | `style.css` | 460 | all the editor styling |  |
| 3 | `body.html` | 70 | the page markup: plan frame, PROGRAM and ANALYSIS tables, buttons, dialogs |  |
| 4 | `js/01-layout-data.js` | 158 | EMBED (the empty start layout), team colours, marker scale, chairs, renderLayout (draws the plan) | teamColor, paintColor, scaleMarkers, lnote, xesc, f1, sideOf, chairsFor, fr, renderLayout |
| 5 | `js/02-flags.js` | 116 | Red flags (set by the user 24 Nov 2026) | flagsKey, flagsShown, flagLines, drawFlags, ok, onDesk, cross, boxAt, hit, pickLayout, watchPlan |
| 6 | `js/03-milestones.js` | 186 | Milestones (set by the user 19 Nov 2026) | msCol, msDb, msLoaded, msShow, msForTabs, norm, generic, msLoad, msToday, msSave, msGo, msAdd, msEdit, fin, msDrag, mv, up, msNudge, msRender, START |
| 7 | `js/04-pdf-read.js` | 230 | Reading an uploaded PDF. This page only reads what is drawn (lines, curves, fills, text) and draws the plan | loadScript, loadPdf, pdfSegments, pdfInk, elRead, elArc, planPicture, pageRaw, brain, readLayout |
| 8 | `js/07-osh.js` | 45 | OSH = open space hidden (rules C2 23-25) | oshFromPage, oshFlags, seatRange, backfillOsh |
| 9 | `js/08-elements.js` | 30 | C3 element inventory (set by the user 25 Nov 2026) | elOfPage, backfillElements |
| 10 | `js/09-shell.js` | 178 | The building's shell and core, read from the plan picture, for placing team markers | buildingShell, backfillShell, clearOldSeating |
| 11 | `js/10-main-view.js` | 108 | MAIN starts here: zoom, fit, pan, row and desk highlight | MAIN, fitWidth, applyZoom, fitTotals, alignTotalsTop, alignProgram, deskOfRow, rowOfDesk, hi, endPan |
| 12 | `js/11-main-edit-save.js` | 286 | drag a person, desk click, undo history, painting names and totals, save to the database, shading | dropDeskAt, deskClick, setOpen, keepHist, batch, pushStep, clone, cap, paint, paintEds, paintDeskNames, paintTeamNames, paintFlags, paintTotal, showErr, save, paintShade, shade, shadeTeam |
| 13 | `js/12-main-teams-markers.js` | 522 | teams: moving, added teams, seat types (single, OSH), flag answers, team markers and where they may stand | moveOf, ctr, needOf, addedIds, esc, personRow, syncAdded, pruneBenches, benchFill, isSingleDesk, rowSingle, isOshDesk, rowHidden, autoType, answerFlag, placeFlagTog, captureKinds, markerBase, leadBase, setLabels, resetMarker, placeOutside, fitView, readShell, paintFloor, paintOutlines, cellAt, nearDesk, inCore, spacesOf, walkOut, shellSpot, spreadMarkers, svgBox, hitsBuilding, hitsBox, clearMarkers |
| 14 | `js/13-main-parked-relayout.js` | 366 | parked markers of unseated teams, relayout (redraws everything after a change), seat summary per type | loadInk, parkMarkers, relayout, paintTyHi, renderSummary |
| 15 | `js/14-main-analysis.js` | 180 | ANALYSIS table (C3 element inventory), marker dragging, writing seats, moves and types to the database | anRows, anDraw, anRender, anPick, svgPt, saveMove, endDrag, saveGone, saveDeleted, placeConfirm, closeConfirm, writePseat, writePkind, writePtype, writeAssign, writeMove |
| 16 | `js/15-main-suggest.js` | 202 | Suggest: seats every team following the rules | suggest |
| 17 | `js/16-main-export.js` | 181 | Download layout (PNG picture with header) and Download program (Excel / CSV) | closeExp, fileBase, offerFile, downloadFile, nextOption, logoData, planImage, rrect, makeLayoutPicture, programRows, makeProgramCsv, makeProgramXlsx, deliverMany |
| 18 | `js/17-main-title-upload.js` | 102 | layout title, Upload layout, Delete program, CSV and Excel file loading | paintTitle, saveTitle, layNote, parseCSV, loadXLSX |
| 19 | `js/18-main-program-read.js` | 342 | reading a program table (columns, types), Upload program, HR seating files (rules D4), messy-table message | isNum, kindOf, mapColumns, normType, readSheets, filled, sheetText, aiPrompt, aiRead, columnRead, hrCell, hrType, hrHeader, hrRead, progNote, addProgram, isMessy, showMessy, readProgram |
| 20 | `js/19-main-sheet.js` | 189 | Google Sheet as the program (Link sheet, Update), sheet tabs = milestones | paintSheet, onSite, googleReady, googleToken, gfetch, sheetTables, sheetError, saveSheetMeta, syncProgram, programTabs, loadTabs, updateFromSheet, pickSheet, closeSheetMenu |
| 21 | `js/20-main-downloads-drop.js` | 268 | download destinations (device / Google Drive), drag and drop of files, MAIN ends, START() | destOf, onDrive, paintDest, saveDest, tapToShare, sendNow, pickFolder, lastFolder, dropKind, hasFiles, dropMark, clearDrop, saveAdded |
