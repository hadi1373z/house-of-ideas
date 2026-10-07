Option Explicit
Dim fso, shell, root, runtime, launcher
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
runtime = fso.BuildPath(root, "runtime\node.exe")
launcher = fso.BuildPath(root, "server\launch.mjs")
If Not fso.FileExists(runtime) Or Not fso.FileExists(launcher) Then
  MsgBox "Keep the runtime and server folders beside Stop House.vbs, then try again.", vbExclamation, "House of Ideas"
  WScript.Quit 1
End If
shell.CurrentDirectory = root
shell.Run Chr(34) & runtime & Chr(34) & " " & Chr(34) & launcher & Chr(34) & " --stop", 0, False
