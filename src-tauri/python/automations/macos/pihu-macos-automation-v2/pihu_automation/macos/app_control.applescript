use framework "AppKit"
use scripting additions

on run argv
    set appName to item 1 of argv
    set operation to item 2 of argv
    set windowNumber to (item 3 of argv) as integer
    if appName is "" then
        tell application "System Events"
            set targetProcess to first application process whose frontmost is true
            set appName to name of targetProcess
            set targetPID to unix id of targetProcess
            set bundleID to bundle identifier of targetProcess
        end tell
    else
        if operation is "open" or operation is "focus" then
            tell application appName to activate
            return "Activated " & appName
        end if
        if not (application appName is running) then error appName & " is not running. Open it first."
        set bundleID to id of application appName
        tell application "System Events"
            set matchingProcesses to application processes whose bundle identifier is bundleID
            if (count of matchingProcesses) is 0 then error "No accessible process for " & appName
            set targetPID to unix id of item 1 of matchingProcesses
        end tell
    end if
    if operation is "quit" then
        tell application id bundleID to quit
        return "Quit requested for " & appName & ". Any unsaved-document dialog still needs your attention."
    end if
    tell application "System Events"
        if UI elements enabled is false then error "Grant PIHU OS Accessibility access in System Settings > Privacy & Security > Accessibility."
        tell (first application process whose unix id is targetPID)
            if operation is "hide" then
                set visible to false
                return "Hidden " & appName
            end if
            set visible to true
            if operation is "focus" or operation is "open" then
                set frontmost to true
                return "Focused " & appName
            end if
            if operation is "windows" then
                set descriptionText to ""
                repeat with n from 1 to count of windows
                    set descriptionText to descriptionText & n & ": " & (name of window n as text) & linefeed
                end repeat
                return descriptionText
            end if
            if (count of windows) < windowNumber then error "Window " & windowNumber & " is unavailable in " & appName
            set targetWindow to window windowNumber
            if operation is "minimize" then
                set value of attribute "AXMinimized" of targetWindow to true
                if value of attribute "AXMinimized" of targetWindow is not true then error "This window did not minimize."
                return "Minimized window " & windowNumber & " of " & appName
            end if
            if operation is "restore" then
                set value of attribute "AXMinimized" of targetWindow to false
                if value of attribute "AXMinimized" of targetWindow is not false then error "This window did not restore."
                set frontmost to true
                try
                    perform action "AXRaise" of targetWindow
                end try
                return "Restored window " & windowNumber & " of " & appName
            end if
            set frontmost to true
            if operation is "close_window" then
                perform action "AXPress" of (first button of targetWindow whose subrole is "AXCloseButton")
                return "Close requested for window " & windowNumber & " of " & appName & ". Check any unsaved-document dialog."
            end if
            if operation is "fullscreen" or operation is "exit_fullscreen" then
                set desiredFullscreen to operation is "fullscreen"
                set value of attribute "AXFullScreen" of targetWindow to desiredFullscreen
                return operation & " requested for " & appName
            end if
            if operation is "move" then
                set position of targetWindow to {(item 4 of argv) as integer, (item 5 of argv) as integer}
                return "Moved window of " & appName
            end if
            if operation is "resize" then
                set size of targetWindow to {(item 6 of argv) as integer, (item 7 of argv) as integer}
                return "Resized window of " & appName
            end if
            if operation is "maximize" or operation is "snap_left" or operation is "snap_right" then
                try
                    if value of attribute "AXFullScreen" of targetWindow then error "Exit fullscreen before arranging this window."
                on error errorText number errorNumber
                    if errorText is "Exit fullscreen before arranging this window." then error errorText
                end try
                set value of attribute "AXMinimized" of targetWindow to false
                set windowPosition to position of targetWindow
                set windowSize to size of targetWindow
            else
                error "Unsupported operation: " & operation
            end if
        end tell
    end tell
    -- Screen coordinates from AppKit use bottom-left; Accessibility uses top-left.
    set allScreens to current application's NSScreen's screens()
    if (allScreens's |count|() as integer) is 0 then error "No graphical display available for window arrangement."
    set mainFrame to (allScreens's objectAtIndex:0)'s frame()
    set mainHeight to item 2 of item 2 of mainFrame
    set chosenScreen to allScreens's objectAtIndex:0
    set centerX to (item 1 of windowPosition) + (item 1 of windowSize) / 2
    set centerY to (item 2 of windowPosition) + (item 2 of windowSize) / 2
    repeat with screenObject in allScreens
        set screenFrame to screenObject's frame()
        set screenX to item 1 of item 1 of screenFrame
        set screenY to mainHeight - (item 2 of item 1 of screenFrame) - (item 2 of item 2 of screenFrame)
        if centerX ≥ screenX and centerX < screenX + (item 1 of item 2 of screenFrame) and centerY ≥ screenY and centerY < screenY + (item 2 of item 2 of screenFrame) then set chosenScreen to screenObject
    end repeat
    set usableFrame to chosenScreen's visibleFrame()
    set targetX to (item 1 of item 1 of usableFrame) as integer
    set targetY to (mainHeight - (item 2 of item 1 of usableFrame) - (item 2 of item 2 of usableFrame)) as integer
    set targetWidth to (item 1 of item 2 of usableFrame) as integer
    set targetHeight to (item 2 of item 2 of usableFrame) as integer
    if operation is "snap_left" or operation is "snap_right" then
        set halfWidth to (targetWidth div 2)
        if operation is "snap_right" then set targetX to targetX + halfWidth
        set targetWidth to halfWidth
    end if
    tell application "System Events"
        tell (first application process whose unix id is targetPID)
            set position of targetWindow to {targetX, targetY}
            set size of targetWindow to {targetWidth, targetHeight}
            set actualSize to size of targetWindow
            if (item 1 of actualSize) < targetWidth - 10 or (item 2 of actualSize) < targetHeight - 10 then error "The application constrained the window size; it may not support this layout."
        end tell
    end tell
    return operation & " completed for window " & windowNumber & " of " & appName
end run
