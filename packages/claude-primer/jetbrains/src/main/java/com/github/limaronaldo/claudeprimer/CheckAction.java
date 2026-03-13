package com.github.limaronaldo.claudeprimer;

import com.intellij.openapi.actionSystem.AnAction;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.project.Project;
import com.intellij.execution.configurations.GeneralCommandLine;
import com.intellij.execution.process.OSProcessHandler;
import org.jetbrains.annotations.NotNull;

public class CheckAction extends AnAction {
    @Override
    public void actionPerformed(@NotNull AnActionEvent e) {
        Project project = e.getProject();
        if (project == null || project.getBasePath() == null) return;

        try {
            GeneralCommandLine cmd = new GeneralCommandLine("claude-primer", project.getBasePath(), "--check", "--no-git-check");
            cmd.setWorkDirectory(project.getBasePath());
            OSProcessHandler handler = new OSProcessHandler(cmd);
            handler.startNotify();
        } catch (Exception ex) {
            com.intellij.openapi.ui.Messages.showErrorDialog(
                project,
                "Could not launch claude-primer: " + ex.getMessage() + "\n\nMake sure it is installed and on your PATH:\n  npm install -g claude-primer",
                "Claude Primer Error"
            );
        }
    }
}
