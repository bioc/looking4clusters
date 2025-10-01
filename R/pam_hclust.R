## Input Vars
# distance: the distance measure to be used. This must be one of "euclidean",
# "maximum", "manhattan", "canberra", "binary" or "minkowski".
# agglomeration: the agglomeration method to be used.  This should be one of
# "ward.D", "ward.D2", "single", "complete", "average", "mcquitty", "median" or
# "centroid".
# selectedk: Number of clusters selected by the user. If 'NULL', default values
# are used (kmin=2,kmax=10), else, a rank of 5 units around 'selectedk' is
# calculated .
##

run_pam_hclust <- function(object, distance="euclidean",
        agglomeration="complete", selectedk=NULL, threads=NULL){
    if(requireNamespace("fpc",quietly=TRUE)){

data <- object$data

if(is.null(selectedk)){
    kmin<-2
    kmax<-10
}else{
    kmin<-(selectedk-5)
    kmax<-(selectedk+5)
}

if(kmin <= 1){
    kmin <- 2
}
if(kmax >= nrow(data)){
    kmax <- nrow(data)-1
}
if(kmin >= kmax){
    kmin <- kmax-1
}

iter <- kmax-kmin+1

dissimilarity <- get_dissimilarity(distance,data,threads)

pamresults <- run_pam(selectedk,dissimilarity,kmin,kmax,iter,data)
allClassfPam <- pamresults[[1]]
numberClustersPAM <- pamresults[[2]]

hclustresults <- run_hclust(agglomeration,dissimilarity,
    kmin,kmax,selectedk,iter)
Hclusters <- hclustresults[[1]]
numberClustersHclust <- hclustresults[[2]]

object <- clustering_tables(object,iter,allClassfPam,numberClustersPAM,
    Hclusters,numberClustersHclust)

    }else{
        warning("Install 'fpc' to get pam and hclust clusters.")
    }
    return(object)
}

run_pam <- function(selectedk,dissimilarity,kmin,kmax,iter,data){
## PAM:
allClassfPam <- NULL
numberClustersPAM <- NULL
if(requireNamespace("cluster",quietly=TRUE)){
    if(is.null(selectedk)){
        # Calinski Harabasz
        pamk<-fpc::pamk(dissimilarity, krange=kmin:kmax, criterion="ch",
            usepam=TRUE, scaling=FALSE, diss=TRUE)
        numberClustersPAM<-pamk$nc
    }else{
        numberClustersPAM <- selectedk
    }

    # All clusters 
    all.pam <- lapply(kmin:kmax, function(k){
        cluster::pam(dissimilarity, k, diss=TRUE, cluster.only=FALSE,
            keep.diss=FALSE, keep.data=FALSE)
    })

    allClassfPam <- vapply(seq_len(iter),function(k){
        all.pam[[k]]$clustering
    }, integer(nrow(data)))

# Explanation of any default parameters: 
# criterion: "ch" = calinski Harabasz index
# usepam: If TRUE, PAM clustering method is applied, else, CLARA clustering
# method is computed. 
# diss: Are input data a dissimilarity matrix?
# scaling: After calculate the dissimilarity matrix, Want to scale it?
# cluster.only: If TRUE, only the clustering will be computed and returned
}else{
    warning("Install 'cluster' to get pam clusters.")
}
return(list(allClassfPam,numberClustersPAM))
}

get_dissimilarity <- function(distance,data,threads){
    # Calculate dissimilarity matrix (parallel)
    if(!(distance %in% c("euclidean", "maximum", "manhattan",
            "canberra", "binary", "minkowski"))){
        distance <- "euclidean"
    }
    if(requireNamespace("parallelDist",quietly=TRUE)){
        dissimilarity <- parallelDist::parDist(data,
            method=distance, threads=threads)
    }else{
        dissimilarity <- dist(data,method=distance)
    }
    return(dissimilarity)
}

run_hclust <- function(agglomeration,dissimilarity,kmin,kmax,selectedk,iter){
## HCLUST:
Hclusters <- NULL
numberClustersHclust <- NULL
if(requireNamespace("dendextend",quietly=TRUE)){

if(!(agglomeration %in% c("ward.D", "ward.D2", "single", "complete",
        "average", "mcquitty", "median", "centroid")))
    agglomeration <- "complete"
hierarchical<-hclust(dissimilarity,method = agglomeration)
Hclusters<-dendextend::cutree(hierarchical,k=seq(kmin,kmax,1))

if(is.null(selectedk)){
    # Calinski Harabasz
    chIndex<-numeric()
    for(i in seq_len(iter))
        chIndex[i] <- fpc::cluster.stats(d = dissimilarity,
            clustering = Hclusters[,i])$ch
    numberClustersHclust<-(which(chIndex==max(chIndex))+kmin-1)
}else{
    numberClustersHclust <- selectedk
}

}else{
    warning("Install 'dendextend' to get hclust clusters.")
}
return(list(Hclusters,numberClustersHclust))
}

clustering_tables <- function(object,iter,allClassfPam,numberClustersPAM,
    Hclusters,numberClustersHclust){
# Clustering tables

for(i in seq_len(iter)){
    if(length(allClassfPam)){
        clusters <- as.factor(paste0("pam_",allClassfPam[,i]))
        optim_cluster <- FALSE
        if(length(levels(clusters))==numberClustersPAM){
            optim_cluster <- TRUE
        }
        object <- addcluster(object, clusters,
            "pam", optim_cluster = optim_cluster)
    }
    if(length(Hclusters)){
        clusters <- as.factor(paste0("hclust_",Hclusters[,i]))
        optim_cluster <- FALSE
        if(length(levels(clusters))==numberClustersHclust){
            optim_cluster <- TRUE
        }
        object <- addcluster(object, clusters, "hclust",
            optim_cluster = optim_cluster)
    }
}

# 'numberClustersPAM' and 'numberClustersHclust' are the default number of
# clusters values to represent in the graphs if automatic mode is select, else,
# 'selectedk' is used.
return(object)
}
