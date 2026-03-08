package com.github.limaronaldo.claudeprimer;

import com.intellij.openapi.actionSystem.AnAction;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.project.Project;
import com.intellij.execution.configurations.GeneralCommandLine;
import com.intellij.execution.process.OSProcessHandler;
import org.jetbrains.annotations.NotNull;

public class DiffAction extends AnAction {
    @Override
    public void actionPerformed(@NotNull AnActionEvent e) {
        Project project = e.getProject();
        if (project == null || project.getBasePath() == null) return;

        try {
            GeneralCommandLine cmd = new GeneralCommandLine("claude-primer", project.getBasePath(), "--diff");
            cmd.setWorkDirectory(project.getBasePath());
            OSProcessHandler handler = new OSProcessHandler(cmd);
            handler.startNotify();
        } catch (Exception ex) {
            // claude-primer not found
        }
    }
}
