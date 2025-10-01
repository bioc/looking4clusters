# Multi Dimensional Scaling

run_mds <- function(object,threads=NULL){

    data <- object$data

    # Distance matrix
    if(requireNamespace("parallelDist",quietly=TRUE)){
        distMatrix <- parallelDist::parDist(data,
            method="canberra", threads=threads)
    }else{
        message("installing 'parallelDist' can improve performance")
        distMatrix <- dist(data,method="canberra")
    }

    # Classical Multi Dimensional Scaling (cMDS)
    cmds <- cmdscale(distMatrix, k=2)
    colnames(cmds) <- c("cMDS1","cMDS2")

    return(addreduction(object,cmds,"cmds"))
}
