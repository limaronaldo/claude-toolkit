package com.github.limaronaldo.claudeprimer;

import com.intellij.openapi.actionSystem.AnAction;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.project.Project;
import com.intellij.execution.configurations.GeneralCommandLine;
import com.intellij.execution.process.OSProcessHandler;
import com.intellij.execution.process.ProcessAdapter;
import com.intellij.execution.process.ProcessEvent;
import com.intellij.openapi.util.Key;
import org.jetbrains.annotations.NotNull;

public class GenerateAction extends AnAction {
    @Override
    public void actionPerformed(@NotNull AnActionEvent e) {
        Project project = e.getProject();
        if (project == null || project.getBasePath() == null) return;

        try {
            GeneralCommandLine cmd = new GeneralCommandLine("claude-primer", project.getBasePath(), "--yes", "--git-mode", "skip");
            cmd.setWorkDirectory(project.getBasePath());
            OSProcessHandler handler = new OSProcessHandler(cmd);
            handler.addProcessListener(new ProcessAdapter() {
                @Override
                public void processTerminated(@NotNull ProcessEvent event) {
                    if (event.getExitCode() == 0) {
                        project.getBaseDir().refresh(true, true);
                    }
                }
            });
            handler.startNotify();
        } catch (Exception ex) {
            // claude-primer not found on PATH
        }
    }
}
