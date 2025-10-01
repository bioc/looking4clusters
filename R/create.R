l4c <- function(data, groups = NULL, components = FALSE, running_all = TRUE,
    distance = "euclidean", agglomeration = "complete", selectedk = NULL,
    perplex = 30, maxIter = 1000, threads = NULL, force_execution = FALSE){

    if(is.null(dim(data))){
        stop("data: incorrect dimensions. A matrix like object is required.")
    }

    if(running_all && (ncol(data) > 5000 || nrow(data) > 5000)){
        if(force_execution){
            message(
"Too large matrix, could cause performance problems with some methods"
            )
        }else{
            message(
"Too large matrix, could cause performance problems with some methods,
they will be omitted"
            )
        }
    }

    object <- create_l4c(data,components)

    if(!is.null(groups)){
        object <- addcluster(object,groups,myGroups=TRUE)
    }

    if(running_all){
        object <- running_clusters(object, selectedk, data, force_execution,
            distance, agglomeration, threads)
        object <- running_reductions(object, data, force_execution,
            threads, perplex, maxIter)
    }

    return(object)
}

running_clusters <- function(object, selectedk, data, force_execution,
        distance, agglomeration, threads){

    message("Running kmeans...")
    object <- run_kmeans(object,selectedk)
    if(force_execution || !(nrow(data) > 5000)){
        message("Running pam and hclust...")
        object <- run_pam_hclust(object, distance, agglomeration,
            selectedk, threads)
    }

    return(object)
}

running_reductions <- function(object, data, force_execution,
        threads, perplex, maxIter){

    message("Running pca...")
    object <- run_pca(object)
    message("Running tsne...")
    object <- run_tsne(object,perplex,maxIter)
    if(force_execution || !(nrow(data) > 5000)){
        message("Running mds...")
        object <- run_mds(object,threads)
    }
    if(force_execution || !(ncol(data) > 5000)){
        message("Running nmf...")
        object <- run_nmf(object)
    }
    message("Running umap...")
    object <- run_umap(object)

    return(object)
}

Ncomponents <- function(variability){
    nComp <- 4
    divisor <- 10
    if(length(variability)*0.9>1){
        variability <-
            variability[seq_len(as.integer(length(variability)*0.9))]
    }

    change <- variability[-length(variability)] - variability[-1]
    propChange <-
        (mean(change)/mean(sort(change,decreasing=TRUE)[seq_len(3)]))*100
    if(propChange>10 && propChange<=15){
        divisor <- 5
    }
    if(propChange>15){
        return(nComp)
    }
    minVar <- max(change)/divisor
    CutoffCriterion <- (change<minVar)
    position <- numeric()
    for(i in seq_len(length(variability)-1)){
        if(CutoffCriterion[i]==TRUE){
            k <- k+1
        }else{
            k <- 0
        }
        position <- c(position,k)
        if(k>7 || (i>10 && k>3)){
            n <- (max(which(position==1))-1)
            if(n>1){
                nComp <- n
            }
        }
    }
    return(nComp)
}

create_l4c <- function(data,components=FALSE){

    samples <- rownames(data)
    if(is.null(samples)){
        samples <- paste0("sample_",seq_len(nrow(data)))
    }

    if(components){
        if(nrow(data)<5){
            stop(
"You cannot apply to components for less than five samples."
            )
        }
        if(ncol(data)<5){
            stop(
"You cannot apply to components for less than five variables."
            )
        }

        ldata <- log2(data+1)
        lpca <- prcomp(ldata)
        var <- summary(lpca)$importance[2,]
        nc <- Ncomponents(var)
        pca <- prcomp(data,scale=FALSE)
        data <- pca$x[,seq_len(nc)]
    }

    return(structure(list(data=data.matrix(data), samples=samples,
        variables=colnames(data), options=list()), class="looking4clusters"))
}

addreduction <- function(object, data, name=NULL){
    if(!inherits(object,"looking4clusters")){
        stop("object: must be a 'looking4clusters' object")
    }
    if(nrow(data)!=length(object$samples)){
        stop("data: there must be one row per sample")
    }
    if(!length(object$reductions)){
        object$reductions <- list()
    }
    if(is.null(name)){
        name <- paste0("reduction_",length(object$reductions)+1)
    }else{
        name <- clean_names(name)
    }
    object$reductions[[name]] <- data[,seq_len(2)]
    return(object)
}

addcluster <- function(object, data, name=NULL, groupStatsBy=FALSE,
        myGroups=FALSE, optim_cluster=FALSE){
    if(!inherits(object,"looking4clusters")){
        stop("object: must be a 'looking4clusters' object")
    }
    if(length(data)!=length(object$samples)){
        stop("data: there must be one per sample")
    }
    if(!length(object$clusters)){
        object$clusters <- list()
    }
    if(is.null(name)){
        name <- paste0("cluster_",length(object$clusters)+1)
    }else{
        name <- clean_names(name)
    }
    data <- as.factor(data)
    if(length(object$clusters[[name]])){
        if(is.factor(object$clusters[[name]])){
            object$clusters[[name]] <-
                data.frame(V1=object$clusters[[name]],V2=data)
            colnames(object$clusters[[name]]) <-
                vapply(object$clusters[[name]],function(x){
                    return(paste0("levels_",length(levels(x))))
                }, character(1))
            attr(object$clusters[[name]],"optim_cluster") <-
                length(levels(object$clusters[[name]][[1]]))
        }else{
            object$clusters[[name]][[paste0("levels_",
                length(levels(data)))]] <- data
        }
        if(optim_cluster){
            attr(object$clusters[[name]], "optim_cluster") <-
                length(levels(data))
        }
    }else{
        object$clusters[[name]] <- data
    }
    if(groupStatsBy){
        object$options$groupStatsBy <- c(object$options$groupStatsBy,name)
    }
    if(myGroups){
        object$options$myGroups <- name
    }
    return(object)
}

writehtml <- function(object, includeData, directory){
    datadir <- file.path(directory,"data")
    dir.create(datadir)

    write(object$samples,file=file.path(datadir,"samples.txt"))
    if(includeData){
        write_data(object,datadir)
    }

    write_reductions(object,datadir)

    write_clusters(object,datadir)

    www <- wwwDirectory()
    file.copy(file.path(www,"css"), directory, recursive=TRUE)
    file.copy(file.path(www,"js"), directory, recursive=TRUE)
    file.copy(file.path(www,"font"), directory, recursive=TRUE)
    file.copy(file.path(www,"images"), directory, recursive=TRUE)

    html <- scan(file = file.path(www, "template.html"), what = character(0),
        sep = "\n", quiet = TRUE)
    html <- gsub("<!--name-->", basename(directory), html)

    con <- file(indexfile(directory), "a", encoding = "UTF-8")
    write(html[seq_len(which(html=="<!--data-->")-1)],con,append=TRUE)

    for(f in dir(datadir)){
        dat <- scan(file = file.path(datadir,f), what = character(0),
            sep = "\n", quiet = TRUE)
        write(c(paste0("<pre class=\"",gsub(".","_",f,fixed=TRUE),"\">"),
            dat,"</pre>"),con,append=TRUE)
    }

    write(html[(which(html=="<!--data-->")+1):length(html)],con,append=TRUE)
    close(con)

    unlink(datadir, recursive = TRUE)
}

l4chtml <- function(x, includeData = FALSE, directory = NULL){
    if(is.character(x) && file.exists(x) && grepl("\\.json$",x)){
        l4cjson(x,directory)
    }else if(inherits(x,"looking4clusters")){
        if(is.null(directory)){
            directory <- tempfile()
            dir.create(directory)
            writehtml(x, includeData, directory)
            browseURL(normalizePath(indexfile(directory)))
        }else{
            create_l4c_directory(directory)
            writehtml(x, includeData, directory)
            text <- paste0("The graph has been generated in the \"",
            normalizePath(directory),"\" path.")
            message(text)
        }
    }else{
        stop("x: must be a 'looking4clusters' object or a JSON file")
    }
}

write_data <- function(object,datadir){
    write(object$variables,file=file.path(datadir,"variables.txt"))
    adj <- adjacency(object$data)
    adj <- adj[!is.na(adj[,3]),]
    adj[,3] <- signif(adj[,3],3)
    write.table(adj, file = file.path(datadir,"data.tsv"), quote = FALSE,
        sep = "\t", row.names = FALSE, col.names = FALSE)
}

write_reductions <- function(object,datadir){
    if(length(object$reductions)){
        for(reduction in names(object$reductions)){
            write.table(signif(object$reductions[[reduction]],3),
                file=file.path(datadir,paste0(reduction,".csv")),
                row.names=FALSE,col.names=TRUE,sep=",",quote=FALSE)
        }
        write(names(object$reductions),
            file=file.path(datadir,"reductions.txt"))
    }
}

write_clusters <- function(object,datadir){
    if(length(object$clusters)){
        for(cluster in names(object$clusters)){
            cluster_data <- object$clusters[[cluster]]
            if(is.factor(cluster_data)){
                clusternames <- paste0(gsub("|",",",levels(cluster_data),
                    fixed=TRUE),collapse="|")
                samples <- paste0(as.numeric(cluster_data)-1,collapse="|")
            }else{
                clusternames <- vapply(cluster_data,function(x){
                    return(paste0(gsub("|",",",levels(x),
                        fixed=TRUE),collapse="|"))
                }, character(1))
                samples <- vapply(cluster_data,function(x){
                    return(paste0(as.numeric(x)-1,collapse="|"))
                }, character(1))
                write(attr(cluster_data,"optim_cluster"),
                    file=file.path(datadir,
                    paste0(cluster,"_optim_cluster.txt")))
            }
            write.table(data.frame(clusternames, samples),
                file = file.path(datadir, paste0(cluster, ".tsv")),
                quote = FALSE, sep = "\t",
                row.names = FALSE, col.names = FALSE)
        }
        write(names(object$clusters),file=file.path(datadir,"clusters.txt"))
        if(length(object$options$groupStatsBy)){
            write(object$options$groupStatsBy,
                file=file.path(datadir,"groupstatsby.txt"))
        }
        if(length(object$options$myGroups)){
            write(object$options$myGroups,
                file=file.path(datadir,"mygroups.txt"))
        }
    }
}

print.looking4clusters <- function(x, ...){
    cat("An object of class looking4clusters\n")
    cat(paste0(length(x$variables)," variables across ",
        length(x$samples)," samples\n"))
    if(length(x$clusters)){
        cat(paste0(length(x$clusters)," clusters added: ",
            paste0(names(x$clusters),collapse=", "),"\n"))
    }
    if(length(x$reductions)){
        cat(paste0(length(x$reductions)," dimensional reductions added: ",
            paste0(names(x$reductions),collapse=", "),"\n"))
    }
}

looking4clusters <- function(data, groups = NULL, assay = NULL,
    components = FALSE, running_all = TRUE, distance = "euclidean",
    agglomeration = "complete", selectedk = NULL, perplex = 30,
    maxIter = 1000, threads = NULL, force_execution = FALSE){
    if(inherits(data,"Seurat")){
        l4c_Seurat(data, assay)
    }else if(inherits(data,"SingleCellExperiment")){
        l4c_SCE(data, groups, assay)
    }else{
        l4c(data, groups, components, running_all,
        distance, agglomeration, selectedk,
        perplex, maxIter, threads, force_execution)
    }
}

l4cjson <- function(json, directory = NULL){
    writehtmlfromjson <- function(json,directory){
        data <- jsonlite::fromJSON(json)

        www <- wwwDirectory()
        file.copy(file.path(www,"css"), directory, recursive=TRUE)
        file.copy(file.path(www,"js"), directory, recursive=TRUE)
        file.copy(file.path(www,"font"), directory, recursive=TRUE)
        file.copy(file.path(www,"images"), directory, recursive=TRUE)

        html <- scan(file = file.path(www, "template.html"),
            what = character(0), sep = "\n", quiet = TRUE)
        html <- gsub("<!--name-->", basename(directory), html)

        con <- file(indexfile(directory), "a", encoding = "UTF-8")
        write(html[seq_len(which(html=="<!--data-->")-1)],con,append=TRUE)

        for(pre in names(data)){
            txt <- data[[pre]]
            if(!is.character(txt)){
                txt <- jsonlite::toJSON(txt)
            }
            write(c(paste0("<pre class=\"",pre,"\">"),
                txt,"</pre>"),con,append=TRUE)
        }

        write(html[(which(html=="<!--data-->")+1):length(html)],con,append=TRUE)
        close(con)
    }

    if(is.null(directory)){
        directory <- tempfile()
        dir.create(directory)
        writehtmlfromjson(json, directory)
        browseURL(normalizePath(indexfile(directory)))
    }else{
        create_l4c_directory(directory)
        writehtmlfromjson(json, directory)
        text <- paste0("The graph has been generated in the \"",
        normalizePath(directory),"\" path.")
        message(text)
    }
}
