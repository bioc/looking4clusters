l4c_Seurat <- function(object, assay = NULL){
    BiocBaseUtils::checkInstalled("Seurat")

    joinassays <- FALSE
    if(is.null(assay)){
        assay <- Seurat::DefaultAssay(object)
    }else if(!(assay %in% Seurat::Assays(object))){
        if(assay=="all"){
            joinassays <- TRUE
            assay <- Seurat::DefaultAssay(object)
        }else{
            stop("assay: wrong assay especified")
        }
    }

    l4c <- create_l4c(get_scale_data(object,assay,joinassays))

    l4c <- seurat_reductions(l4c,object)


    l4c <- seurat_clusters(l4c,object)

    return(l4c)
}

get_scale_data <- function(object,assay,joinassays){
    counts <- Seurat::GetAssayData(object, layer="counts", assay=assay)
    data <- Seurat::GetAssayData(object, layer="scale.data", assay=assay)
    if(!length(data)){
        stop(
"No layer matching pattern 'scale.data' found. Please run ScaleData and retry"
        )
    }

    if(joinassays){
        for(a in setdiff(Seurat::Assays(object),assay)){
            assaycounts <-
                Seurat::GetAssayData(object, layer="counts", assay=a)
            rownames(assaycounts) <- paste0(rownames(assaycounts),"_",a)
            counts <- rbind(counts, assaycounts)
            assaysdata <-
                Seurat::GetAssayData(object, layer="scale.data", assay=a)
            if(!length(assaysdata)){
                text <- paste0("No layer matching pattern 'scale.data' found ",
                "for '",a,"' assay. Please run ScaleData and retry")
                stop(text)
            }
            rownames(assaysdata) <- paste0(rownames(assaysdata),"_",a)
            data <- rbind(data,assaysdata)
        }
    }

    counts <- t(data.matrix(counts))
    keep <- counts!=0

    data <- t(data.matrix(data))
    data[!keep] <- NA
    return(data)
}

seurat_reductions <- function(l4c,object){
    if('reductions' %in% names(attributes(object))){
        for(reduction in names(object@reductions)){
            mat <- Seurat::Embeddings(object,
                reduction = reduction)[, seq_len(2)]
            l4c <- addreduction(l4c,mat,reduction)
        }
    }
    return(l4c)
}

seurat_clusters <- function(l4c,object){
    if('meta.data' %in% names(attributes(object))){
        for(name in names(object@meta.data)){
            clusters <- object[[name]]
            if(is.data.frame(clusters)){
                if(name %in% names(clusters)){
                    clusters <- clusters[,name]
                }else{
                    next
                }
            }
            if(is.numeric(clusters) || is.factor(clusters)){
                clusters <- as.character(clusters)
            }
            if(!is.character(clusters) ||
                    length(clusters)!=length(l4c$samples)){
                next
            }
            l4c <- addcluster(l4c, clusters,
                name=gsub(".","_",name,fixed=TRUE), groupStatsBy=TRUE)
        }
    }
    return(l4c)
}
