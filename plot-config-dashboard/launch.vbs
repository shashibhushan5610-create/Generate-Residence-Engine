' ============================================================
' launch.vbs — Plot Configuration Dashboard Launcher
' ArchitectOS · Works regardless of .bat file associations
' ============================================================
' Double-click this file to open the dashboard in your browser
' ============================================================

Dim fso, htmlPath, shell

Set fso      = CreateObject("Scripting.FileSystemObject")
Set shell    = CreateObject("WScript.Shell")

' Build absolute path to index.html (same folder as this script)
htmlPath = fso.GetAbsolutePathName(fso.GetParentFolderName(WScript.ScriptFullName) & "\index.html")

' Verify file exists
If Not fso.FileExists(htmlPath) Then
    MsgBox "Cannot find index.html at:" & vbCrLf & htmlPath, vbCritical, "ArchitectOS"
    WScript.Quit
End If

' Open in default browser
shell.Run "explorer """ & htmlPath & """"

Set fso   = Nothing
Set shell = Nothing
