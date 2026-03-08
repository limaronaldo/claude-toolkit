plugins {
    id("java")
    id("org.jetbrains.intellij") version "1.17.2"
}

group = "com.github.limaronaldo"
version = "1.7.0"

repositories {
    mavenCentral()
}

intellij {
    version.set("2024.1")
    type.set("IC")
}

tasks {
    patchPluginXml {
        sinceBuild.set("241")
        untilBuild.set("251.*")
    }
}
